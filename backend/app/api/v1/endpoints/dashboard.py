from __future__ import annotations

import logging
import socket
import time
from datetime import datetime, timezone
from typing import Any

import psutil
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.models.alert import Alert
from app.models.network import NetworkInterface
from app.models.storage import Pool
from app.models.user import User
from app.schemas.system import (
    DashboardResponse,
    NetworkInterfaceSummary,
    PoolSummary,
    ServiceStatus,
    SystemMetrics,
)
from app.services.monitoring import MonitoringService
from app.services.network import NetworkService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["dashboard"])


@router.get("/", response_model=DashboardResponse)
def get_dashboard(
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> DashboardResponse:
    mem = psutil.virtual_memory()
    try:
        boot_time = psutil.boot_time()
        uptime_seconds = max(0, int(time.time() - boot_time))
    except Exception:
        uptime_seconds = 0

    cpu_usage = psutil.cpu_percent(interval=None)

    pools = db.query(Pool).all()
    pool_summaries = [
        PoolSummary(
            id=p.id,
            name=p.name,
            status=p.status,
            health=p.health,
            used_percent=round((p.used_bytes / p.total_bytes * 100), 2)
            if p.total_bytes > 0
            else 0.0,
            total_bytes=p.total_bytes,
            used_bytes=p.used_bytes,
        )
        for p in pools
    ]

    active_alerts_count = db.query(Alert).filter(Alert.is_active.is_(True)).count()

    raw_services = MonitoringService.list_services()
    service_statuses = [
        ServiceStatus(
            name=s["name"],
            status="running" if s.get("active") else "stopped",
            enabled=True,
        )
        for s in raw_services
    ]

    interfaces = db.query(NetworkInterface).all()
    if not interfaces:
        interfaces = NetworkService.scan_interfaces(db)

    interface_summaries = [
        NetworkInterfaceSummary(
            name=i.name,
            ipv4_address=i.ipv4_address,
            state=i.state,
            speed=i.speed,
        )
        for i in interfaces
    ]

    return DashboardResponse(
        hostname=socket.gethostname(),
        uptime_seconds=uptime_seconds,
        cpu_usage=cpu_usage,
        memory_total=mem.total,
        memory_used=mem.used,
        memory_percent=mem.percent,
        pools=pool_summaries,
        alerts_active=active_alerts_count,
        services=service_statuses,
        network_interfaces=interface_summaries,
    )


@router.get("/metrics", response_model=SystemMetrics)
def get_realtime_metrics(
    _: User = Depends(get_current_active_user),
) -> SystemMetrics:
    raw = MonitoringService.get_system_metrics()
    return SystemMetrics(
        timestamp=datetime.fromisoformat(raw["timestamp"]),
        cpu_percent=raw["cpu"]["percent"],
        memory_percent=raw["memory"]["percent"],
        memory_used_bytes=raw["memory"]["used"],
        swap_percent=raw["swap"]["percent"],
        load_avg=raw["cpu"]["load_average"],
        disk_io=raw["disk_io"],
        network_io=raw["network_io"],
        arc_stats=None,
    )


@router.get("/metrics/history")
def get_metrics_history(
    _: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    return {
        "cpu": MonitoringService.get_cpu_history(),
        "memory": MonitoringService.get_memory_history(),
    }
