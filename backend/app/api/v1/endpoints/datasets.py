from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_role
from app.core.events import EventType, event_bus
from app.models.storage import Dataset
from app.models.user import User
from app.schemas.common import ConfirmDestructive, MessageResponse
from app.schemas.sharing import ShareResponse
from app.schemas.storage import DatasetCreate, DatasetResponse, DatasetUpdate
from app.services.audit import AuditService
from app.services.storage import StorageService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["datasets"])


def _parse_size_to_bytes(val: Any) -> int:
    if isinstance(val, int):
        return val
    if not val:
        return 131072
    val_str = str(val).strip().upper()
    if val_str.endswith("K"):
        return int(float(val_str[:-1]) * 1024)
    if val_str.endswith("M"):
        return int(float(val_str[:-1]) * 1024 * 1024)
    if val_str.endswith("G"):
        return int(float(val_str[:-1]) * 1024 * 1024 * 1024)
    try:
        return int(val_str)
    except ValueError:
        return 131072


def _dataset_to_response(d: Dataset) -> DatasetResponse:
    return DatasetResponse(
        id=d.id,
        name=d.name,
        path=d.path,
        pool_id=d.pool_id,
        parent_id=d.parent_id,
        dataset_type=d.dataset_type,
        preset=d.preset,
        compression=d.compression,
        dedup=d.dedup,
        sync_mode=d.sync_mode,
        record_size=_parse_size_to_bytes(d.record_size),
        quota_bytes=d.quota_bytes,
        reservation_bytes=d.reservation_bytes,
        encryption=d.encryption,
        used_bytes=d.used_bytes,
        available_bytes=d.available_bytes,
        mountpoint=d.mountpoint,
        created_at=d.created_at,
        children_count=len(d.children) if d.children else 0,
        snapshot_count=len(d.snapshots) if d.snapshots else 0,
        shares=[ShareResponse.model_validate(s) for s in d.shares] if d.shares else [],
    )


@router.get("/", response_model=list[DatasetResponse])
def list_datasets(
    pool_id: int | None = Query(default=None),
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[DatasetResponse]:
    datasets = StorageService.list_datasets(db, pool_id=pool_id)
    return [_dataset_to_response(d) for d in datasets]


@router.post("/", response_model=DatasetResponse, status_code=status.HTTP_201_CREATED)
def create_dataset(
    data: DatasetCreate,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> DatasetResponse:
    try:
        dataset = StorageService.create_dataset(db, data)
        event_bus.publish(
            EventType.POOL_STATUS,
            {"action": "create_dataset", "dataset_id": dataset.id, "path": dataset.path},
            source="datasets_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="create",
            resource_type="dataset",
            resource_id=str(dataset.id),
            detail={"name": dataset.name, "path": dataset.path, "pool_id": dataset.pool_id},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return _dataset_to_response(dataset)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{id}", response_model=DatasetResponse)
def get_dataset(
    id: int,
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> DatasetResponse:
    try:
        dataset = StorageService.get_dataset(db, id)
        return _dataset_to_response(dataset)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/{id}", response_model=DatasetResponse)
def update_dataset(
    id: int,
    data: DatasetUpdate,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> DatasetResponse:
    try:
        update_data = data.model_dump(exclude_unset=True)
        dataset = StorageService.update_dataset(db, id, update_data)
        event_bus.publish(
            EventType.POOL_STATUS,
            {"action": "update_dataset", "dataset_id": dataset.id, "path": dataset.path},
            source="datasets_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="update",
            resource_type="dataset",
            resource_id=str(dataset.id),
            detail=update_data,
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return _dataset_to_response(dataset)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{id}", response_model=MessageResponse)
def delete_dataset(
    id: int,
    body: ConfirmDestructive,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        StorageService.delete_dataset(db, id, body.confirm_name)
        event_bus.publish(
            EventType.POOL_STATUS,
            {"action": "delete_dataset", "dataset_id": id, "name": body.confirm_name},
            source="datasets_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="delete",
            resource_type="dataset",
            resource_id=str(id),
            detail={"name": body.confirm_name},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return MessageResponse(message=f"Dataset '{body.confirm_name}' successfully deleted")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
