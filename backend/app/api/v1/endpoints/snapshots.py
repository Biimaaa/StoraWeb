from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_role
from app.core.events import EventType, event_bus
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.storage import SnapshotCreate, SnapshotResponse, SnapshotRollback
from app.services.audit import AuditService
from app.services.storage import StorageService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["snapshots"])


@router.get("/", response_model=list[SnapshotResponse])
def list_snapshots(
    dataset_id: int | None = Query(default=None),
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[SnapshotResponse]:
    snapshots = StorageService.list_snapshots(db, dataset_id=dataset_id)
    return [SnapshotResponse.model_validate(s) for s in snapshots]


@router.post("/", response_model=SnapshotResponse, status_code=status.HTTP_201_CREATED)
def create_snapshot(
    data: SnapshotCreate,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> SnapshotResponse:
    try:
        snapshot = StorageService.create_snapshot(db, data)
        event_bus.publish(
            EventType.SNAPSHOT_CREATED,
            {
                "snapshot_id": snapshot.id,
                "dataset_id": snapshot.dataset_id,
                "full_name": snapshot.full_name,
            },
            source="snapshots_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="create",
            resource_type="snapshot",
            resource_id=str(snapshot.id),
            detail={"dataset_id": snapshot.dataset_id, "name": snapshot.name},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return SnapshotResponse.model_validate(snapshot)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{id}", response_model=MessageResponse)
def delete_snapshot(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        StorageService.delete_snapshot(db, id)
        AuditService.log(
            db,
            actor=current_user.username,
            action="delete",
            resource_type="snapshot",
            resource_id=str(id),
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return MessageResponse(message=f"Snapshot {id} deleted successfully")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/{id}/rollback", response_model=MessageResponse)
def rollback_snapshot(
    id: int,
    body: SnapshotRollback,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        StorageService.rollback_snapshot(db, id, body.confirm_name)
        AuditService.log(
            db,
            actor=current_user.username,
            action="rollback",
            resource_type="snapshot",
            resource_id=str(id),
            detail={"confirm_name": body.confirm_name},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return MessageResponse(message=f"Rollback to snapshot '{body.confirm_name}' successful")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
