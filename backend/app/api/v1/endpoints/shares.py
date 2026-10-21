from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_role
from app.core.events import EventType, event_bus
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.sharing import ShareCreate, ShareResponse, ShareUpdate
from app.services.audit import AuditService
from app.services.sharing import SharingService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["shares"])


# -----------------------------------------------------------------------------
# Static / non-parameterized routes (must precede /{id})
# -----------------------------------------------------------------------------


@router.get("/sessions")
def get_active_sessions(
    protocol: str = Query(default="smb", pattern=r"^(smb|nfs)$"),
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    return SharingService.get_active_sessions(db, protocol)


@router.post("/reload", response_model=MessageResponse)
def reload_sharing_daemons(
    request: Request,
    protocol: str | None = Query(default=None, pattern=r"^(smb|nfs)$"),
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if protocol == "smb":
        SharingService.reload_smb()
        msg = "SMB service reloaded successfully"
    elif protocol == "nfs":
        SharingService.reload_nfs()
        msg = "NFS exports reloaded successfully"
    else:
        SharingService.reload_smb()
        SharingService.reload_nfs()
        msg = "Both SMB and NFS services reloaded successfully"

    AuditService.log(
        db,
        actor=current_user.username,
        action="reload",
        resource_type="sharing",
        detail={"protocol": protocol or "all"},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return MessageResponse(message=msg)


# -----------------------------------------------------------------------------
# CRUD Routes
# -----------------------------------------------------------------------------


@router.get("/", response_model=list[ShareResponse])
def list_shares(
    protocol: str | None = Query(default=None, pattern=r"^(smb|nfs)$"),
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[ShareResponse]:
    shares = SharingService.list_shares(db, protocol=protocol)
    return [ShareResponse.model_validate(s) for s in shares]


@router.post("/", response_model=ShareResponse, status_code=status.HTTP_201_CREATED)
def create_share(
    data: ShareCreate,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> ShareResponse:
    try:
        share = SharingService.create_share(db, data)
        event_bus.publish(
            EventType.SHARE_UPDATED,
            {"action": "create", "share_id": share.id, "protocol": share.protocol},
            source="shares_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="create",
            resource_type="share",
            resource_id=str(share.id),
            detail={"name": share.name, "protocol": share.protocol, "path": share.path},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return ShareResponse.model_validate(share)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{id}", response_model=ShareResponse)
def get_share(
    id: int,
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> ShareResponse:
    try:
        share = SharingService.get_share(db, id)
        return ShareResponse.model_validate(share)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/{id}", response_model=ShareResponse)
def update_share(
    id: int,
    data: ShareUpdate,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> ShareResponse:
    try:
        update_data = data.model_dump(exclude_unset=True)
        share = SharingService.update_share(db, id, update_data)
        event_bus.publish(
            EventType.SHARE_UPDATED,
            {"action": "update", "share_id": share.id, "protocol": share.protocol},
            source="shares_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="update",
            resource_type="share",
            resource_id=str(share.id),
            detail=update_data,
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return ShareResponse.model_validate(share)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{id}", response_model=MessageResponse)
def delete_share(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        SharingService.delete_share(db, id)
        event_bus.publish(
            EventType.SHARE_UPDATED,
            {"action": "delete", "share_id": id},
            source="shares_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="delete",
            resource_type="share",
            resource_id=str(id),
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return MessageResponse(message=f"Share {id} deleted successfully")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/{id}/enable", response_model=ShareResponse)
def enable_share(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> ShareResponse:
    try:
        share = SharingService.enable_share(db, id)
        event_bus.publish(
            EventType.SHARE_UPDATED,
            {"action": "enable", "share_id": share.id},
            source="shares_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="enable",
            resource_type="share",
            resource_id=str(share.id),
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return ShareResponse.model_validate(share)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.post("/{id}/disable", response_model=ShareResponse)
def disable_share(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> ShareResponse:
    try:
        share = SharingService.disable_share(db, id)
        event_bus.publish(
            EventType.SHARE_UPDATED,
            {"action": "disable", "share_id": share.id},
            source="shares_api",
        )
        AuditService.log(
            db,
            actor=current_user.username,
            action="disable",
            resource_type="share",
            resource_id=str(share.id),
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return ShareResponse.model_validate(share)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
