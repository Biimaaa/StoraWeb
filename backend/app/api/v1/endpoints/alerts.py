from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_role
from app.models.alert import Alert, NotificationChannel
from app.models.user import User
from app.schemas.alert import (
    AlertDismiss,
    AlertResponse,
    NotificationChannelCreate,
    NotificationChannelResponse,
    NotificationChannelUpdate,
)
from app.schemas.common import MessageResponse
from app.services.alert import AlertService
from app.services.audit import AuditService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["alerts"])


def _alert_to_response(a: Alert) -> AlertResponse:
    return AlertResponse(
        id=a.id,
        level=a.level,
        source=a.source,
        message=a.message,
        detail=a.title,
        dismissed=not a.is_active,
        dismissed_by=a.dismissed_by,
        dismissed_at=a.dismissed_at,
        created_at=a.created_at,
    )


# -----------------------------------------------------------------------------
# Channel Endpoints (must precede /{id})
# -----------------------------------------------------------------------------


@router.get("/channels/", response_model=list[NotificationChannelResponse])
def list_notification_channels(
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[NotificationChannelResponse]:
    channels = db.query(NotificationChannel).order_by(NotificationChannel.name).all()
    return [NotificationChannelResponse.model_validate(c) for c in channels]


@router.post("/channels/", response_model=NotificationChannelResponse, status_code=status.HTTP_201_CREATED)
def create_notification_channel(
    data: NotificationChannelCreate,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> NotificationChannelResponse:
    channel = NotificationChannel(
        name=data.name,
        channel_type=data.channel_type,
        config=data.config,
        enabled=data.enabled,
        min_level=data.min_level,
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)

    AuditService.log(
        db,
        actor=current_user.username,
        action="create",
        resource_type="notification_channel",
        resource_id=str(channel.id),
        detail={"name": channel.name, "channel_type": channel.channel_type},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return NotificationChannelResponse.model_validate(channel)


@router.put("/channels/{id}", response_model=NotificationChannelResponse)
def update_notification_channel(
    id: int,
    data: NotificationChannelUpdate,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> NotificationChannelResponse:
    channel = db.query(NotificationChannel).filter(NotificationChannel.id == id).first()
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification channel {id} not found",
        )

    for field, val in data.model_dump(exclude_unset=True).items():
        if hasattr(channel, field) and val is not None:
            setattr(channel, field, val)

    db.commit()
    db.refresh(channel)

    AuditService.log(
        db,
        actor=current_user.username,
        action="update",
        resource_type="notification_channel",
        resource_id=str(channel.id),
        detail={"name": channel.name},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return NotificationChannelResponse.model_validate(channel)


@router.delete("/channels/{id}", response_model=MessageResponse)
def delete_notification_channel(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    channel = db.query(NotificationChannel).filter(NotificationChannel.id == id).first()
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification channel {id} not found",
        )

    ch_name = channel.name
    db.delete(channel)
    db.commit()

    AuditService.log(
        db,
        actor=current_user.username,
        action="delete",
        resource_type="notification_channel",
        resource_id=str(id),
        detail={"name": ch_name},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return MessageResponse(message=f"Notification channel '{ch_name}' deleted successfully")


# -----------------------------------------------------------------------------
# Dismiss All (must precede /{id})
# -----------------------------------------------------------------------------


@router.post("/dismiss-all", response_model=MessageResponse)
def dismiss_all_alerts(
    request: Request,
    body: AlertDismiss | None = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    dismissed_by = body.dismissed_by if body else current_user.username
    count = AlertService.dismiss_all(db, dismissed_by=dismissed_by)

    AuditService.log(
        db,
        actor=current_user.username,
        action="dismiss_all",
        resource_type="alert",
        detail={"count": count, "dismissed_by": dismissed_by},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return MessageResponse(message=f"Dismissed {count} active alerts")


# -----------------------------------------------------------------------------
# Alert CRUD
# -----------------------------------------------------------------------------


@router.get("/", response_model=list[AlertResponse])
def list_alerts(
    active_only: bool = Query(default=True),
    level: str | None = Query(default=None, pattern=r"^(info|warning|critical|error)$"),
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[AlertResponse]:
    alerts = AlertService.list_alerts(db, active_only=active_only, level=level)
    return [_alert_to_response(a) for a in alerts]


@router.post("/{id}/dismiss", response_model=AlertResponse)
def dismiss_alert(
    id: int,
    request: Request,
    body: AlertDismiss | None = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> AlertResponse:
    dismissed_by = body.dismissed_by if body else current_user.username
    try:
        alert = AlertService.dismiss_alert(db, id, dismissed_by=dismissed_by)
        AuditService.log(
            db,
            actor=current_user.username,
            action="dismiss",
            resource_type="alert",
            resource_id=str(id),
            detail={"dismissed_by": dismissed_by},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return _alert_to_response(alert)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
