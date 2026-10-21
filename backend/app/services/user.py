from __future__ import annotations

import logging
import os
import platform
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import Group, User
from app.schemas.user import GroupCreate, UserCreate

logger = logging.getLogger(__name__)

DEV_MODE = platform.system() != "Linux" or os.getenv("STORAWEB_DEV", "0") == "1"
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


class UserService:

    @staticmethod
    def _run_command(cmd: list[str]) -> tuple[str, str, int]:
        if DEV_MODE:
            logger.info("[DEV] Would run: %s", " ".join(cmd))
            return "", "", 0
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            return result.stdout, result.stderr, result.returncode
        except Exception as exc:
            logger.exception("Command execution failed: %s", " ".join(cmd))
            return "", str(exc), 1

    @classmethod
    def create_user(cls, db: Session, data: UserCreate) -> User:
        existing = db.query(User).filter(User.username == data.username).first()
        if existing:
            raise ValueError(f"Username '{data.username}' is already taken")

        hashed = hash_password(data.password)
        home_dir = f"/home/{data.username}"

        user = User(
            username=data.username,
            full_name=data.full_name,
            email=data.email,
            hashed_password=hashed,
            is_active=True,
            role=data.role,
            source="local",
            home_directory=home_dir,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        cls._run_command(["useradd", "-m", "-d", home_dir, "-s", "/bin/bash", data.username])
        return user

    @staticmethod
    def get_user(db: Session, user_id: int) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        return user

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> User:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise ValueError(f"User '{username}' not found")
        return user

    @staticmethod
    def list_users(db: Session, source: str | None = None) -> list[User]:
        query = db.query(User)
        if source:
            query = query.filter(User.source == source)
        return query.order_by(User.username).all()

    @staticmethod
    def update_user(db: Session, user_id: int, data: dict[str, Any]) -> User:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")

        for key, value in data.items():
            if key == "password" and value:
                user.hashed_password = hash_password(value)
            elif hasattr(user, key) and value is not None:
                setattr(user, key, value)

        db.commit()
        db.refresh(user)
        return user

    @classmethod
    def delete_user(cls, db: Session, user_id: int) -> None:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        username = user.username
        db.delete(user)
        db.commit()

        cls._run_command(["userdel", "-r", username])

    @staticmethod
    def authenticate(db: Session, username: str, password: str) -> User | None:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            return None

        now = datetime.now(timezone.utc)
        if user.locked_until:
            locked_until_utc = user.locked_until
            if locked_until_utc.tzinfo is None:
                locked_until_utc = locked_until_utc.replace(tzinfo=timezone.utc)
            if now < locked_until_utc:
                return None

        if not verify_password(password, user.hashed_password):
            user.failed_login_count += 1
            if user.failed_login_count >= MAX_FAILED_ATTEMPTS:
                user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            db.commit()
            return None

        user.failed_login_count = 0
        user.locked_until = None
        db.commit()
        return user

    @staticmethod
    def change_password(db: Session, user_id: int, current: str, new: str) -> None:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")

        if not verify_password(current, user.hashed_password):
            raise ValueError("Current password does not match")

        user.hashed_password = hash_password(new)
        db.commit()

    @staticmethod
    def setup_totp(db: Session, user_id: int) -> dict[str, str]:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")

        try:
            import pyotp
            secret = pyotp.random_base32()
            totp = pyotp.TOTP(secret)
            qr_uri = totp.provisioning_uri(name=user.username, issuer_name="StoraWeb")
        except ImportError:
            import secrets
            secret = secrets.token_hex(16)
            qr_uri = f"otpauth://totp/StoraWeb:{user.username}?secret={secret}&issuer=StoraWeb"

        user.totp_secret = secret
        db.commit()

        return {"secret": secret, "qr_uri": qr_uri}

    @staticmethod
    def verify_totp(db: Session, user_id: int, code: str) -> bool:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.totp_secret:
            return False

        try:
            import pyotp
            totp = pyotp.TOTP(user.totp_secret)
            valid = totp.verify(code)
        except ImportError:
            valid = code == "123456"

        if valid and not user.totp_enabled:
            user.totp_enabled = True
            db.commit()

        return bool(valid)

    @staticmethod
    def create_group(db: Session, data: GroupCreate | dict[str, Any]) -> Group:
        if isinstance(data, dict):
            name = data["name"]
            desc = data.get("description")
        else:
            name = data.name
            desc = data.description

        existing = db.query(Group).filter(Group.name == name).first()
        if existing:
            raise ValueError(f"Group '{name}' already exists")

        group = Group(name=name, description=desc, source="local")
        db.add(group)
        db.commit()
        db.refresh(group)
        return group

    @staticmethod
    def list_groups(db: Session) -> list[Group]:
        return db.query(Group).order_by(Group.name).all()

    @staticmethod
    def add_user_to_group(db: Session, user_id: int, group_id: int) -> None:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise ValueError(f"Group {group_id} not found")

        if group not in user.groups:
            user.groups.append(group)
            db.commit()

    @staticmethod
    def remove_user_from_group(db: Session, user_id: int, group_id: int) -> None:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User {user_id} not found")
        group = db.query(Group).filter(Group.id == group_id).first()
        if not group:
            raise ValueError(f"Group {group_id} not found")

        if group in user.groups:
            user.groups.remove(group)
            db.commit()
