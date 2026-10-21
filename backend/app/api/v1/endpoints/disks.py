from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_role
from app.core.events import EventType, event_bus
from app.models.user import User
from app.schemas.storage import DiskResponse
from app.services.audit import AuditService
from app.services.monitoring import MonitoringService
from app.services.storage import StorageService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["disks"])


class SmartTestRequest(BaseModel):
    test_type: str = Field(default="short", pattern=r"^(short|long|conveyance|offline)$")


@router.get("/", response_model=list[DiskResponse])
def list_disks(
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[DiskResponse]:
    disks = StorageService.list_disks(db)
    return [DiskResponse.model_validate(d) for d in disks]


@router.post("/scan", response_model=list[DiskResponse])
def scan_disks(
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> list[DiskResponse]:
    disks = StorageService.scan_disks(db)

    event_bus.publish(
        EventType.DISK_CHANGE,
        {"action": "scan", "count": len(disks)},
        source="disks_api",
    )

    AuditService.log(
        db,
        actor=current_user.username,
        action="scan",
        resource_type="disk",
        detail={"found_disks": len(disks)},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )

    return [DiskResponse.model_validate(d) for d in disks]


@router.get("/{id}", response_model=DiskResponse)
def get_disk(
    id: int,
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> DiskResponse:
    try:
        disk = StorageService.get_disk(db, id)
        return DiskResponse.model_validate(disk)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get("/{id}/smart")
def get_disk_smart_data(
    id: int,
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        disk = StorageService.get_disk(db, id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return MonitoringService.get_smart_data(disk.device_name)


@router.post("/{id}/smart-test")
def trigger_smart_test(
    id: int,
    request: Request,
    test_type: str = Query(default="short", pattern=r"^(short|long|conveyance|offline)$"),
    body: SmartTestRequest | None = None,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        disk = StorageService.get_disk(db, id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    actual_test_type = body.test_type if body else test_type

    try:
        result = MonitoringService.run_smart_test(disk.device_name, actual_test_type)
        AuditService.log(
            db,
            actor=current_user.username,
            action="smart_test",
            resource_type="disk",
            resource_id=str(disk.id),
            detail={"device": disk.device_name, "test_type": actual_test_type},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return result
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
