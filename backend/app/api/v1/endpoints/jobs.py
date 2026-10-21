from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.models.job import Job
from app.models.user import User
from app.schemas.job import JobResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["jobs"])


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


@router.get("/", response_model=list[JobResponse])
def list_jobs(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=50, ge=1, le=500),
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[JobResponse]:
    query = db.query(Job)
    if status_filter:
        query = query.filter(Job.status == status_filter)
    jobs = query.order_by(Job.created_at.desc()).limit(limit).all()
    return [_job_to_response(j) for j in jobs]


@router.get("/{id}", response_model=JobResponse)
def get_job(
    id: int,
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> JobResponse:
    job = db.query(Job).filter(Job.id == id).first()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Job {id} not found")
    return _job_to_response(job)
