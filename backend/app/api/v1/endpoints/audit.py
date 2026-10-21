from __future__ import annotations

import logging
import math
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_role
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogResponse
from app.schemas.common import PaginatedResponse
from app.services.audit import AuditService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["audit"])


def _log_to_response(log: AuditLog) -> AuditLogResponse:
    return AuditLogResponse(
        id=log.id,
        timestamp=log.created_at,
        actor=log.actor,
        action=log.action,
        resource_type=log.resource_type,
        resource_id=log.resource_id,
        detail=log.detail,
        ip_address=log.ip_address,
        user_agent=None,
    )


@router.get("/export")
def export_audit_logs(
    export_format: str = Query(default="json", alias="format", pattern=r"^(csv|json)$"),
    actor: str | None = Query(default=None),
    action: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    result: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    _: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> Response:
    filters: dict[str, Any] = {}
    if actor:
        filters["actor"] = actor
    if action:
        filters["action"] = action
    if resource_type:
        filters["resource_type"] = resource_type
    if result:
        filters["result"] = result
    if date_from:
        filters["start_time"] = date_from
    if date_to:
        filters["end_time"] = date_to

    content = AuditService.export_logs(db, filters=filters, export_format=export_format)

    media_type = "text/csv" if export_format == "csv" else "application/json"
    filename = f"audit_logs.{export_format}"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/", response_model=PaginatedResponse[AuditLogResponse])
def list_audit_logs(
    actor: str | None = Query(default=None),
    action: str | None = Query(default=None),
    resource_type: str | None = Query(default=None),
    result: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=500),
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> PaginatedResponse[AuditLogResponse]:
    filters: dict[str, Any] = {}
    if actor:
        filters["actor"] = actor
    if action:
        filters["action"] = action
    if resource_type:
        filters["resource_type"] = resource_type
    if result:
        filters["result"] = result
    if date_from:
        filters["start_time"] = date_from
    if date_to:
        filters["end_time"] = date_to

    logs, total = AuditService.list_logs(db, filters=filters, page=page, per_page=per_page)
    pages = math.ceil(total / per_page) if total > 0 else 0

    return PaginatedResponse[AuditLogResponse](
        items=[_log_to_response(log) for log in logs],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )
