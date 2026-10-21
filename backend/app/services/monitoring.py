from __future__ import annotations

import collections
import json
import logging
import os
import platform
import subprocess
from datetime import datetime, timezone
from typing import Any

import psutil
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.storage import Pool

logger = logging.getLogger(__name__)

DEV_MODE = platform.system() != "Linux" or os.getenv("STORAWEB_DEV", "0") == "1"

_cpu_history: collections.deque[dict[str, Any]] = collections.deque(maxlen=60)
_memory_history: collections.deque[dict[str, Any]] = collections.deque(maxlen=60)


class MonitoringService:

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

    @staticmethod
    def get_system_metrics() -> dict[str, Any]:
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count(logical=True) or 1

        mem = psutil.virtual_memory()
        swap = psutil.swap_memory()

        load_avg = [0.0, 0.0, 0.0]
        if hasattr(os, "getloadavg"):
            try:
                load_avg = list(os.getloadavg())
            except OSError:
                pass

        disk_io = psutil.disk_io_counters()
        net_io = psutil.net_io_counters()

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "cpu": {
                "percent": cpu_percent,
                "count": cpu_count,
                "load_average": load_avg,
            },
            "memory": {
                "total": mem.total,
                "available": mem.available,
                "used": mem.used,
                "percent": mem.percent,
            },
            "swap": {
                "total": swap.total,
                "used": swap.used,
                "free": swap.free,
                "percent": swap.percent,
            },
            "disk_io": {
                "read_bytes": disk_io.read_bytes if disk_io else 0,
                "write_bytes": disk_io.write_bytes if disk_io else 0,
                "read_count": disk_io.read_count if disk_io else 0,
                "write_count": disk_io.write_count if disk_io else 0,
            },
            "network_io": {
                "bytes_sent": net_io.bytes_sent if net_io else 0,
                "bytes_recv": net_io.bytes_recv if net_io else 0,
                "packets_sent": net_io.packets_sent if net_io else 0,
                "packets_recv": net_io.packets_recv if net_io else 0,
            },
        }

    @classmethod
    def get_dashboard(cls, db: Session) -> dict[str, Any]:
        metrics = cls.get_system_metrics()

        pools = db.query(Pool).all()
        pool_summaries = [
            {
                "id": p.id,
                "name": p.name,
                "status": p.status,
                "health": p.health,
                "total_bytes": p.total_bytes,
                "used_bytes": p.used_bytes,
                "free_bytes": p.free_bytes,
                "used_percent": round((p.used_bytes / p.total_bytes * 100), 2)
                if p.total_bytes > 0
                else 0.0,
            }
            for p in pools
        ]

        active_alerts = (
            db.query(Alert)
            .filter(Alert.is_active.is_(True))
            .order_by(Alert.created_at.desc())
            .limit(10)
            .all()
        )
        alert_summaries = [
            {
                "id": a.id,
                "level": a.level,
                "source": a.source,
                "title": a.title,
                "message": a.message,
                "created_at": a.created_at.isoformat(),
            }
            for a in active_alerts
        ]

        services = cls.list_services()

        return {
            "metrics": metrics,
            "pools": pool_summaries,
            "alerts": alert_summaries,
            "services": services,
        }

    @staticmethod
    def get_cpu_history() -> list[dict[str, Any]]:
        return list(_cpu_history)

    @staticmethod
    def get_memory_history() -> list[dict[str, Any]]:
        return list(_memory_history)

    @classmethod
    def collect_metrics(cls) -> None:
        now_str = datetime.now(timezone.utc).isoformat()

        cpu_percent = psutil.cpu_percent(interval=None)
        _cpu_history.append({"timestamp": now_str, "percent": cpu_percent})

        mem = psutil.virtual_memory()
        _memory_history.append({
            "timestamp": now_str,
            "percent": mem.percent,
            "used": mem.used,
            "total": mem.total,
        })

    @classmethod
    def get_smart_data(cls, device: str) -> dict[str, Any]:
        stdout, stderr, rc = cls._run_command(["smartctl", "--json", "-a", device])
        if rc == 0 and stdout.strip():
            try:
                return json.loads(stdout)
            except json.JSONDecodeError:
                pass

        return {
            "device": device,
            "smart_status": {"passed": True},
            "temperature": {"current": 35},
            "power_on_time": {"hours": 1200},
            "mock": True,
        }

    @classmethod
    def run_smart_test(cls, device: str, test_type: str = "short") -> dict[str, Any]:
        valid_types = {"short", "long", "conveyance", "offline"}
        if test_type not in valid_types:
            raise ValueError(f"Invalid test type: {test_type}. Must be one of {valid_types}")

        stdout, stderr, rc = cls._run_command(["smartctl", f"-t{test_type}", device])
        if rc != 0 and not DEV_MODE:
            raise RuntimeError(f"smartctl test failed: {stderr}")

        return {
            "device": device,
            "test_type": test_type,
            "status": "started",
            "message": f"{test_type.capitalize()} test started for {device}",
        }

    @classmethod
    def get_service_status(cls, service_name: str) -> dict[str, Any]:
        stdout, stderr, rc = cls._run_command(["systemctl", "is-active", service_name])
        active = stdout.strip() == "active" if rc == 0 else DEV_MODE
        return {
            "name": service_name,
            "status": "active" if active else "inactive",
            "active": active,
        }

    @classmethod
    def list_services(cls) -> list[dict[str, Any]]:
        key_services = ["smbd", "nfs-server", "ssh", "zfs-zed", "systemd-journald"]
        return [cls.get_service_status(srv) for srv in key_services]
