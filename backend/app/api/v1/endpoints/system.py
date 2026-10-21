from __future__ import annotations

import logging
import os
import platform
import subprocess
import time
from typing import Any

import psutil
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_active_user, get_db, require_role
from app.core.security import hash_password, validate_password_policy
from app.models.network import NetworkInterface, SystemConfig
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.system import ServiceStatus, SetupWizard
from app.services.audit import AuditService
from app.services.monitoring import MonitoringService
from app.services.network import NetworkService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["system"])

DEV_MODE = platform.system() != "Linux" or os.getenv("STORAWEB_DEV", "0") == "1"


def _run_system_cmd(cmd: list[str]) -> tuple[str, str, int]:
    if DEV_MODE:
        logger.info("[DEV] Would run system command: %s", " ".join(cmd))
        return "", "", 0
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return res.stdout, res.stderr, res.returncode
    except Exception as exc:
        logger.exception("Failed to run system command: %s", " ".join(cmd))
        return "", str(exc), 1


class ConfigUpdateRequest(BaseModel):
    value: Any


@router.get("/info")
def get_system_info(
    _: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    try:
        boot_time = psutil.boot_time()
        uptime_seconds = max(0, int(time.time() - boot_time))
    except Exception:
        uptime_seconds = 0

    return {
        "app_name": settings.APP_NAME,
        "version": settings.VERSION,
        "os_name": platform.system(),
        "os_release": platform.release(),
        "os_version": platform.version(),
        "kernel": platform.release(),
        "architecture": platform.machine(),
        "processor": platform.processor(),
        "python_version": platform.python_version(),
        "uptime_seconds": uptime_seconds,
        "hostname": platform.node(),
    }


@router.get("/services", response_model=list[ServiceStatus])
def get_services_status(
    _: User = Depends(get_current_active_user),
) -> list[ServiceStatus]:
    raw_services = MonitoringService.list_services()
    return [
        ServiceStatus(
            name=s["name"],
            status="running" if s.get("active") else "stopped",
            enabled=True,
        )
        for s in raw_services
    ]


@router.post("/services/{name}/restart", response_model=MessageResponse)
def restart_service(
    name: str,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    stdout, stderr, rc = _run_system_cmd(["systemctl", "restart", name])
    if rc != 0 and not DEV_MODE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to restart service '{name}': {stderr}",
        )

    AuditService.log(
        db,
        actor=current_user.username,
        action="restart_service",
        resource_type="service",
        resource_id=name,
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return MessageResponse(message=f"Service '{name}' restarted successfully")


@router.post("/reboot", response_model=MessageResponse)
def reboot_system(
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    AuditService.log(
        db,
        actor=current_user.username,
        action="reboot",
        resource_type="system",
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    _run_system_cmd(["systemctl", "reboot"])
    return MessageResponse(message="System reboot initiated")


@router.post("/shutdown", response_model=MessageResponse)
def shutdown_system(
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    AuditService.log(
        db,
        actor=current_user.username,
        action="shutdown",
        resource_type="system",
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    _run_system_cmd(["systemctl", "poweroff"])
    return MessageResponse(message="System shutdown initiated")


@router.post("/setup", response_model=MessageResponse)
def initial_setup_wizard(
    data: SetupWizard,
    request: Request,
    db: Session = Depends(get_db),
) -> MessageResponse:
    valid, msg = validate_password_policy(data.admin_password)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    # 1. Update or create admin user
    admin_user = db.query(User).filter(User.username == "admin").first()
    if admin_user:
        admin_user.hashed_password = hash_password(data.admin_password)
        admin_user.is_active = True
    else:
        admin_user = User(
            username="admin",
            full_name="Administrator",
            email="admin@localhost",
            hashed_password=hash_password(data.admin_password),
            is_active=True,
            role="admin",
            source="local",
        )
        db.add(admin_user)

    # 2. Set Hostname
    NetworkService.set_hostname(data.hostname, db=db)

    # 3. Store system locale settings
    general_cfg = db.query(SystemConfig).filter(SystemConfig.key == "general").first()
    if general_cfg:
        general_cfg.value = {"language": data.language, "timezone": data.timezone}
    else:
        general_cfg = SystemConfig(
            key="general",
            value={"language": data.language, "timezone": data.timezone},
        )
        db.add(general_cfg)

    # 4. Configure network if primary interface exists
    primary_iface = db.query(NetworkInterface).filter(NetworkInterface.interface_type == "physical").first()
    if not primary_iface:
        primary_iface = db.query(NetworkInterface).first()

    if primary_iface:
        primary_iface.dhcp = data.network.dhcp
        if not data.network.dhcp:
            primary_iface.ipv4_address = data.network.ipv4_address
            primary_iface.ipv4_netmask = data.network.ipv4_netmask
            primary_iface.gateway = data.network.gateway
        if data.network.dns_servers:
            primary_iface.dns_servers = data.network.dns_servers
            NetworkService.set_dns_config(data.network.dns_servers, db=db)

    db.commit()

    AuditService.log(
        db,
        actor="setup_wizard",
        action="setup",
        resource_type="system",
        detail={"hostname": data.hostname, "language": data.language, "timezone": data.timezone},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return MessageResponse(message="Initial onboarding setup completed successfully")


@router.get("/config")
def get_system_config(
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    configs = db.query(SystemConfig).all()
    return {cfg.key: cfg.value for cfg in configs}


@router.put("/config/{key}", response_model=MessageResponse)
def update_system_config(
    key: str,
    body: ConfigUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    cfg = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    if not cfg:
        cfg = SystemConfig(key=key, value=body.value)
        db.add(cfg)
    else:
        cfg.value = body.value

    db.commit()

    AuditService.log(
        db,
        actor=current_user.username,
        action="update_config",
        resource_type="config",
        resource_id=key,
        detail={"key": key, "value": body.value},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return MessageResponse(message=f"Configuration '{key}' updated successfully")
