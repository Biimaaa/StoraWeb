import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

_failed_attempts: dict[str, list[float]] = {}

LOCKOUT_THRESHOLD = 5
LOCKOUT_DURATION_SECONDS = 900


def hash_password(password: str) -> str:
    pwd_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def generate_api_key() -> str:
    return f"sw_{secrets.token_urlsafe(32)}"


def validate_api_key(api_key: str) -> bool:
    return bool(api_key and api_key.startswith("sw_") and len(api_key) > 10)


def validate_password_policy(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit"
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        return False, "Password must contain at least one special character"
    return True, "Password meets policy requirements"


def record_failed_attempt(identifier: str) -> None:
    now = time.time()
    if identifier not in _failed_attempts:
        _failed_attempts[identifier] = []
    _failed_attempts[identifier] = [
        t for t in _failed_attempts[identifier] if now - t < LOCKOUT_DURATION_SECONDS
    ]
    _failed_attempts[identifier].append(now)


def is_account_locked(identifier: str) -> bool:
    now = time.time()
    if identifier not in _failed_attempts:
        return False
    attempts = [t for t in _failed_attempts[identifier] if now - t < LOCKOUT_DURATION_SECONDS]
    _failed_attempts[identifier] = attempts
    return len(attempts) >= LOCKOUT_THRESHOLD


def clear_failed_attempts(identifier: str) -> None:
    _failed_attempts.pop(identifier, None)


class RateLimiter:
    def __init__(self, max_requests: int = 60, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = {}

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        if key not in self._requests:
            self._requests[key] = []
        self._requests[key] = [
            t for t in self._requests[key] if now - t < self.window_seconds
        ]
        if len(self._requests[key]) >= self.max_requests:
            return False
        self._requests[key].append(now)
        return True

    def remaining(self, key: str) -> int:
        now = time.time()
        if key not in self._requests:
            return self.max_requests
        recent = [t for t in self._requests[key] if now - t < self.window_seconds]
        return max(0, self.max_requests - len(recent))
