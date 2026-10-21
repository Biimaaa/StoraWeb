from __future__ import annotations

import logging
import os
import platform
import subprocess
from typing import Any

from sqlalchemy.orm import Session

from app.models.sharing import Share
from app.models.storage import Dataset
from app.schemas.sharing import ShareCreate

logger = logging.getLogger(__name__)

DEV_MODE = platform.system() != "Linux" or os.getenv("STORAWEB_DEV", "0") == "1"


class SharingService:

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
    def create_share(cls, db: Session, data: ShareCreate) -> Share:
        dataset = db.query(Dataset).filter(Dataset.id == data.dataset_id).first()
        if not dataset:
            raise ValueError(f"Dataset {data.dataset_id} not found")

        path = data.path or dataset.mountpoint or f"/{dataset.path}"
        settings_dict = data.settings.model_dump() if data.settings else {}

        share = Share(
            name=data.name,
            protocol=data.protocol,
            dataset_id=data.dataset_id,
            path=path,
            enabled=data.enabled,
            settings=settings_dict,
        )
        db.add(share)
        db.commit()
        db.refresh(share)

        if data.enabled:
            if data.protocol == "smb":
                cls.reload_smb()
            elif data.protocol == "nfs":
                cls.reload_nfs()

        return share

    @staticmethod
    def get_share(db: Session, share_id: int) -> Share:
        share = db.query(Share).filter(Share.id == share_id).first()
        if not share:
            raise ValueError(f"Share {share_id} not found")
        return share

    @staticmethod
    def list_shares(db: Session, protocol: str | None = None) -> list[Share]:
        query = db.query(Share)
        if protocol:
            query = query.filter(Share.protocol == protocol)
        return query.order_by(Share.name).all()

    @classmethod
    def update_share(cls, db: Session, share_id: int, data: dict[str, Any]) -> Share:
        share = db.query(Share).filter(Share.id == share_id).first()
        if not share:
            raise ValueError(f"Share {share_id} not found")
        for key, value in data.items():
            if key == "settings" and value is not None:
                if hasattr(value, "model_dump"):
                    value = value.model_dump()
                share.settings = value
            elif hasattr(share, key) and value is not None:
                setattr(share, key, value)
        db.commit()
        db.refresh(share)

        if share.protocol == "smb":
            cls.reload_smb()
        elif share.protocol == "nfs":
            cls.reload_nfs()

        return share

    @classmethod
    def delete_share(cls, db: Session, share_id: int) -> None:
        share = db.query(Share).filter(Share.id == share_id).first()
        if not share:
            raise ValueError(f"Share {share_id} not found")
        protocol = share.protocol
        db.delete(share)
        db.commit()

        if protocol == "smb":
            cls.reload_smb()
        elif protocol == "nfs":
            cls.reload_nfs()

    @classmethod
    def enable_share(cls, db: Session, share_id: int) -> Share:
        share = db.query(Share).filter(Share.id == share_id).first()
        if not share:
            raise ValueError(f"Share {share_id} not found")
        share.enabled = True
        db.commit()
        db.refresh(share)

        if share.protocol == "smb":
            cls.reload_smb()
        elif share.protocol == "nfs":
            cls.reload_nfs()

        return share

    @classmethod
    def disable_share(cls, db: Session, share_id: int) -> Share:
        share = db.query(Share).filter(Share.id == share_id).first()
        if not share:
            raise ValueError(f"Share {share_id} not found")
        share.enabled = False
        db.commit()
        db.refresh(share)

        if share.protocol == "smb":
            cls.reload_smb()
        elif share.protocol == "nfs":
            cls.reload_nfs()

        return share

    @classmethod
    def get_active_sessions(cls, db: Session, protocol: str) -> list[dict[str, Any]]:
        if protocol == "smb":
            stdout, stderr, rc = cls._run_command(["smbstatus", "--json"])
            if rc == 0 and stdout.strip():
                try:
                    import json
                    data = json.loads(stdout)
                    sessions = data.get("sessions", {})
                    return [
                        {
                            "user": info.get("username", ""),
                            "host": info.get("remote_machine", ""),
                            "share": info.get("service", ""),
                            "connected_since": info.get("connection_time", ""),
                        }
                        for info in sessions.values()
                    ]
                except Exception:
                    logger.exception("Failed to parse smbstatus output")
        elif protocol == "nfs":
            stdout, stderr, rc = cls._run_command(["showmount", "--no-headers", "-a"])
            if rc == 0 and stdout.strip():
                sessions: list[dict[str, Any]] = []
                for line in stdout.strip().splitlines():
                    parts = line.split(":")
                    if len(parts) == 2:
                        sessions.append({"host": parts[0].strip(), "path": parts[1].strip()})
                return sessions
        return []

    @staticmethod
    def generate_smb_config(shares: list[Share]) -> str:
        lines: list[str] = [
            "[global]",
            "   workgroup = WORKGROUP",
            "   server string = StoraWeb SMB Server",
            "   security = user",
            "   map to guest = Bad User",
            "   log file = /var/log/samba/log.%m",
            "   max log size = 1000",
            "",
        ]

        for share in shares:
            if not share.enabled or share.protocol != "smb":
                continue
            settings = share.settings or {}
            lines.append(f"[{share.name}]")
            lines.append(f"   path = {share.path}")
            lines.append(f"   browsable = {'yes' if settings.get('browsable', True) else 'no'}")
            lines.append(f"   read only = {'yes' if settings.get('readonly', False) else 'no'}")
            lines.append(f"   guest ok = {'yes' if settings.get('guest_ok', False) else 'no'}")

            if settings.get("recycle_bin", False):
                lines.append("   vfs objects = recycle")
                lines.append("   recycle:repository = .recycle/%U")
                lines.append("   recycle:keeptree = yes")
                lines.append("   recycle:versions = yes")

            if settings.get("time_machine", False):
                lines.append("   fruit:time machine = yes")
                lines.append("   vfs objects = catia fruit streams_xattr")

            allowed = settings.get("allowed_users")
            if allowed:
                lines.append(f"   valid users = {' '.join(allowed)}")

            denied = settings.get("denied_users")
            if denied:
                lines.append(f"   invalid users = {' '.join(denied)}")

            lines.append("")

        return "\n".join(lines)

    @staticmethod
    def generate_nfs_exports(shares: list[Share]) -> str:
        lines: list[str] = []
        for share in shares:
            if not share.enabled or share.protocol != "nfs":
                continue
            settings = share.settings or {}
            hosts = settings.get("hosts", ["*"])
            security = settings.get("security", ["sys"])
            sec_str = ":".join(security)

            options = [f"sec={sec_str}", "rw", "sync", "no_subtree_check"]

            maproot_user = settings.get("maproot_user")
            maproot_group = settings.get("maproot_group")
            if maproot_user:
                options.append(f"anonuid={maproot_user}")
            if maproot_group:
                options.append(f"anongid={maproot_group}")

            opts_str = ",".join(options)
            for host in hosts:
                lines.append(f"{share.path} {host}({opts_str})")

        return "\n".join(lines)

    @classmethod
    def reload_smb(cls) -> None:
        cls._run_command(["systemctl", "reload", "smbd"])

    @classmethod
    def reload_nfs(cls) -> None:
        cls._run_command(["exportfs", "-ra"])

    @staticmethod
    def get_network_path(share: Share, hostname: str) -> str:
        if share.protocol == "smb":
            return f"\\\\{hostname}\\{share.name}"
        return f"{hostname}:{share.path}"
