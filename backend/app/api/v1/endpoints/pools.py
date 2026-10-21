from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_role
from app.core.events import EventType, event_bus
from app.models.job import Job
from app.models.user import User
from app.schemas.common import ConfirmDestructive, MessageResponse
from app.schemas.job import JobResponse
from app.schemas.storage import PoolCreate, PoolResponse, PoolUpdate, VdevConfig
from app.services.audit import AuditService
from app.services.storage import StorageService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["pools"])


class ReplaceDiskRequest(BaseModel):
    old_disk_id: int
    new_disk_id: int


class ImportPoolRequest(BaseModel):
    pool_name: str = Field(min_length=1, max_length=100)


def _job_to_response(job: Job) -> JobResponse:
    return JobResponse(
        id=job.id,
        job_type=job.job_type,
        description=job.description,
        status=job.status,
        progress=job.progress,
        result=job.result,
        error=job.error,
        started_at=job.started_at,
        finished_at=job.completed_at,
        created_at=job.created_at,
    )


@router.get("/", response_model=list[PoolResponse])
def list_pools(
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[PoolResponse]:
    pools = StorageService.list_pools(db)
    return [PoolResponse.model_validate(p) for p in pools]


@router.post("/", response_model=PoolResponse, status_code=status.HTTP_201_CREATED)
def create_pool(
    data: PoolCreate,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> PoolResponse:
    try:
        pool = StorageService.create_pool(db, data)
        event_bus.publish(
            EventType.POOL_STATUS,
            {"action": "create", "pool_id": pool.id, "name": pool.name, "health": pool.health},
            source="pools_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="create",
            resource_type="pool",
            resource_id=str(pool.id),
            detail={"name": pool.name},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return PoolResponse.model_validate(pool)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/import", response_model=PoolResponse)
def import_pool(
    body: ImportPoolRequest,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> PoolResponse:
    try:
        pool = StorageService.import_pool(db, body.pool_name)
        event_bus.publish(
            EventType.POOL_STATUS,
            {"action": "import", "pool_id": pool.id, "name": pool.name},
            source="pools_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="import",
            resource_type="pool",
            resource_id=str(pool.id),
            detail={"name": pool.name},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return PoolResponse.model_validate(pool)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{id}")
def get_pool_detail(
    id: int,
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    try:
        pool = StorageService.get_pool(db, id)
        live_status = StorageService.get_pool_status(db, id)
        pool_resp = PoolResponse.model_validate(pool).model_dump()
        pool_resp["live_status"] = live_status
        return pool_resp
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/{id}", response_model=PoolResponse)
def update_pool(
    id: int,
    data: PoolUpdate,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> PoolResponse:
    try:
        update_data = data.model_dump(exclude_unset=True)
        pool = StorageService.update_pool(db, id, update_data)
        event_bus.publish(
            EventType.POOL_STATUS,
            {"action": "update", "pool_id": pool.id, "name": pool.name},
            source="pools_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="update",
            resource_type="pool",
            resource_id=str(pool.id),
            detail=update_data,
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return PoolResponse.model_validate(pool)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{id}", response_model=MessageResponse)
def destroy_pool(
    id: int,
    body: ConfirmDestructive,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        StorageService.delete_pool(db, id, body.confirm_name)
        event_bus.publish(
            EventType.POOL_STATUS,
            {"action": "delete", "pool_id": id, "name": body.confirm_name},
            source="pools_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="delete",
            resource_type="pool",
            resource_id=str(id),
            detail={"name": body.confirm_name},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return MessageResponse(message=f"Pool '{body.confirm_name}' successfully destroyed")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/{id}/scrub", response_model=JobResponse)
def start_pool_scrub(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> JobResponse:
    try:
        job = StorageService.start_scrub(db, id)
        event_bus.publish(
            EventType.JOB_PROGRESS,
            {"job_id": job.id, "job_type": job.job_type, "status": job.status},
            source="pools_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="scrub",
            resource_type="pool",
            resource_id=str(id),
            detail={"job_id": job.id},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return _job_to_response(job)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{id}/expand", response_model=PoolResponse)
def expand_pool(
    id: int,
    body: VdevConfig,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> PoolResponse:
    try:
        pool = StorageService.expand_pool(db, id, body.model_dump())
        event_bus.publish(
            EventType.POOL_STATUS,
            {"action": "expand", "pool_id": pool.id, "name": pool.name},
            source="pools_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="expand",
            resource_type="pool",
            resource_id=str(pool.id),
            detail=body.model_dump(),
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return PoolResponse.model_validate(pool)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{id}/replace-disk", response_model=JobResponse)
def replace_pool_disk(
    id: int,
    body: ReplaceDiskRequest,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> JobResponse:
    try:
        job = StorageService.replace_disk(db, id, body.old_disk_id, body.new_disk_id)
        event_bus.publish(
            EventType.JOB_PROGRESS,
            {"job_id": job.id, "job_type": job.job_type, "status": job.status},
            source="pools_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="replace_disk",
            resource_type="pool",
            resource_id=str(id),
            detail={"old_disk_id": body.old_disk_id, "new_disk_id": body.new_disk_id},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return _job_to_response(job)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/{id}/export", response_model=MessageResponse)
def export_pool(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        StorageService.export_pool(db, id)
        event_bus.publish(
            EventType.POOL_STATUS,
            {"action": "export", "pool_id": id},
            source="pools_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="export",
            resource_type="pool",
            resource_id=str(id),
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return MessageResponse(message=f"Pool {id} successfully exported")
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
