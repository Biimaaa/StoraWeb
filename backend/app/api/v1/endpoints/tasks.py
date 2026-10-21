from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_role
from app.core.events import EventType, event_bus
from app.models.job import Job
from app.models.task import ReplicationTask, ScheduledTask
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.job import JobResponse
from app.schemas.task import (
    ReplicationTaskCreate,
    ReplicationTaskResponse,
    ScheduledTaskCreate,
    ScheduledTaskResponse,
    ScheduledTaskUpdate,
)
from app.services.audit import AuditService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tasks"])


class ReplicationTaskUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    source_dataset_id: int | None = None
    direction: str | None = Field(default=None, pattern=r"^(push|pull)$")
    transport: str | None = Field(default=None, pattern=r"^(ssh|local)$")
    target_host: str | None = None
    target_port: int | None = Field(default=None, ge=1, le=65535)
    target_dataset: str | None = None
    recursive: bool | None = None
    incremental: bool | None = None
    schedule: str | None = None
    retention_policy: str | None = Field(default=None, pattern=r"^(source|custom|none)$")
    retention_count: int | None = Field(default=None, ge=1)
    enabled: bool | None = None


def _scheduled_task_to_response(t: ScheduledTask) -> ScheduledTaskResponse:
    return ScheduledTaskResponse(
        id=t.id,
        name=t.name,
        task_type=t.task_type,
        schedule=t.schedule,
        config=t.config or {},
        enabled=t.enabled,
        last_run=t.last_run,
        next_run=t.next_run,
        last_result=t.last_status,
        created_at=t.created_at,
    )


def _replication_task_to_response(r: ReplicationTask) -> ReplicationTaskResponse:
    return ReplicationTaskResponse(
        id=r.id,
        name=r.name,
        source_dataset_id=r.source_dataset_id,
        direction=r.direction,
        transport=r.transport,
        target_host=r.target_host or "",
        target_port=r.target_port,
        target_dataset=r.target_dataset,
        recursive=r.recursive,
        incremental=r.incremental,
        schedule=r.schedule or "",
        retention_policy=r.retention_policy,
        retention_count=r.retention_count or 10,
        enabled=r.enabled,
        last_run=r.last_run,
        last_result=r.last_status,
        last_snapshot=None,
        created_at=r.created_at,
    )


def _job_to_response(j: Job) -> JobResponse:
    return JobResponse(
        id=j.id,
        job_type=j.job_type,
        description=j.description,
        status=j.status,
        progress=j.progress,
        result=j.result,
        error=j.error,
        started_at=j.started_at,
        finished_at=j.completed_at,
        created_at=j.created_at,
    )


# -----------------------------------------------------------------------------
# Scheduled Tasks
# -----------------------------------------------------------------------------


@router.get("/scheduled", response_model=list[ScheduledTaskResponse])
def list_scheduled_tasks(
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[ScheduledTaskResponse]:
    tasks = db.query(ScheduledTask).order_by(ScheduledTask.name).all()
    return [_scheduled_task_to_response(t) for t in tasks]


@router.post("/scheduled", response_model=ScheduledTaskResponse, status_code=status.HTTP_201_CREATED)
def create_scheduled_task(
    data: ScheduledTaskCreate,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> ScheduledTaskResponse:
    task = ScheduledTask(
        name=data.name,
        task_type=data.task_type,
        schedule=data.schedule,
        config=data.config,
        enabled=data.enabled,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    AuditService.log(
        db,
        actor=current_user.username,
        action="create",
        resource_type="scheduled_task",
        resource_id=str(task.id),
        detail={"name": task.name, "task_type": task.task_type},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return _scheduled_task_to_response(task)


@router.put("/scheduled/{id}", response_model=ScheduledTaskResponse)
def update_scheduled_task(
    id: int,
    data: ScheduledTaskUpdate,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> ScheduledTaskResponse:
    task = db.query(ScheduledTask).filter(ScheduledTask.id == id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scheduled task {id} not found")

    for k, v in data.model_dump(exclude_unset=True).items():
        if hasattr(task, k) and v is not None:
            setattr(task, k, v)

    db.commit()
    db.refresh(task)

    AuditService.log(
        db,
        actor=current_user.username,
        action="update",
        resource_type="scheduled_task",
        resource_id=str(task.id),
        detail={"name": task.name},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return _scheduled_task_to_response(task)


@router.delete("/scheduled/{id}", response_model=MessageResponse)
def delete_scheduled_task(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    task = db.query(ScheduledTask).filter(ScheduledTask.id == id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scheduled task {id} not found")

    task_name = task.name
    db.delete(task)
    db.commit()

    AuditService.log(
        db,
        actor=current_user.username,
        action="delete",
        resource_type="scheduled_task",
        resource_id=str(id),
        detail={"name": task_name},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return MessageResponse(message=f"Scheduled task '{task_name}' deleted successfully")


@router.post("/scheduled/{id}/run", response_model=JobResponse)
def run_scheduled_task(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> JobResponse:
    task = db.query(ScheduledTask).filter(ScheduledTask.id == id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Scheduled task {id} not found")

    now = datetime.now(timezone.utc)
    task.last_run = now
    task.last_status = "running"

    job = Job(
        job_type=f"task:{task.task_type}",
        description=f"Manual execution of task: {task.name}",
        status="running",
        progress=0,
        started_at=now,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    event_bus.publish(
        EventType.JOB_PROGRESS,
        {"job_id": job.id, "job_type": job.job_type, "status": job.status},
        source="tasks_api",
    )

    AuditService.log(
        db,
        actor=current_user.username,
        action="run_task",
        resource_type="scheduled_task",
        resource_id=str(task.id),
        detail={"job_id": job.id, "task_name": task.name},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return _job_to_response(job)


# -----------------------------------------------------------------------------
# Replication Tasks
# -----------------------------------------------------------------------------


@router.get("/replication", response_model=list[ReplicationTaskResponse])
def list_replication_tasks(
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[ReplicationTaskResponse]:
    tasks = db.query(ReplicationTask).order_by(ReplicationTask.name).all()
    return [_replication_task_to_response(r) for r in tasks]


@router.post("/replication", response_model=ReplicationTaskResponse, status_code=status.HTTP_201_CREATED)
def create_replication_task(
    data: ReplicationTaskCreate,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> ReplicationTaskResponse:
    task = ReplicationTask(
        name=data.name,
        source_dataset_id=data.source_dataset_id,
        direction=data.direction,
        transport=data.transport,
        target_host=data.target_host,
        target_port=data.target_port,
        target_dataset=data.target_dataset,
        recursive=data.recursive,
        incremental=data.incremental,
        schedule=data.schedule,
        retention_policy=data.retention_policy,
        retention_count=data.retention_count,
        enabled=data.enabled,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    AuditService.log(
        db,
        actor=current_user.username,
        action="create",
        resource_type="replication_task",
        resource_id=str(task.id),
        detail={"name": task.name, "target": task.target_dataset},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return _replication_task_to_response(task)


@router.put("/replication/{id}", response_model=ReplicationTaskResponse)
def update_replication_task(
    id: int,
    data: ReplicationTaskUpdate,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> ReplicationTaskResponse:
    task = db.query(ReplicationTask).filter(ReplicationTask.id == id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Replication task {id} not found")

    for k, v in data.model_dump(exclude_unset=True).items():
        if hasattr(task, k) and v is not None:
            setattr(task, k, v)

    db.commit()
    db.refresh(task)

    AuditService.log(
        db,
        actor=current_user.username,
        action="update",
        resource_type="replication_task",
        resource_id=str(task.id),
        detail={"name": task.name},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return _replication_task_to_response(task)


@router.delete("/replication/{id}", response_model=MessageResponse)
def delete_replication_task(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    task = db.query(ReplicationTask).filter(ReplicationTask.id == id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Replication task {id} not found")

    task_name = task.name
    db.delete(task)
    db.commit()

    AuditService.log(
        db,
        actor=current_user.username,
        action="delete",
        resource_type="replication_task",
        resource_id=str(id),
        detail={"name": task_name},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return MessageResponse(message=f"Replication task '{task_name}' deleted successfully")


@router.post("/replication/{id}/run", response_model=JobResponse)
def run_replication_task(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> JobResponse:
    task = db.query(ReplicationTask).filter(ReplicationTask.id == id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Replication task {id} not found")

    now = datetime.now(timezone.utc)
    task.last_run = now
    task.last_status = "running"

    job = Job(
        job_type="replication",
        description=f"Manual execution of replication: {task.name}",
        status="running",
        progress=0,
        started_at=now,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    event_bus.publish(
        EventType.JOB_PROGRESS,
        {"job_id": job.id, "job_type": job.job_type, "status": job.status},
        source="tasks_api",
    )

    AuditService.log(
        db,
        actor=current_user.username,
        action="run_replication",
        resource_type="replication_task",
        resource_id=str(task.id),
        detail={"job_id": job.id, "task_name": task.name},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return _job_to_response(job)
