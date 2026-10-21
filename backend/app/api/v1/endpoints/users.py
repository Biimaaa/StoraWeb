from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_role
from app.core.security import validate_password_policy
from app.models.user import Group, User
from app.schemas.common import MessageResponse
from app.schemas.user import (
    GroupCreate,
    GroupResponse,
    GroupUpdate,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from app.services.audit import AuditService
from app.services.user import UserService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["users"])


def _group_to_response(group: Group) -> GroupResponse:
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        source=group.source,
        created_at=group.created_at,
        member_count=len(group.users) if group.users else 0,
    )


# -----------------------------------------------------------------------------
# Groups Endpoints (defined before /{id} to prevent path conflicts)
# -----------------------------------------------------------------------------


@router.get("/groups/", response_model=list[GroupResponse])
def list_groups(
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[GroupResponse]:
    groups = UserService.list_groups(db)
    return [_group_to_response(g) for g in groups]


@router.post("/groups/", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    data: GroupCreate,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> GroupResponse:
    try:
        group = UserService.create_group(db, data)
        AuditService.log(
            db,
            actor=current_user.username,
            action="create",
            resource_type="group",
            resource_id=str(group.id),
            detail={"name": group.name},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return _group_to_response(group)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.put("/groups/{id}", response_model=GroupResponse)
def update_group(
    id: int,
    data: GroupUpdate,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> GroupResponse:
    group = db.query(Group).filter(Group.id == id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group {id} not found")

    if data.name is not None and data.name != group.name:
        existing = db.query(Group).filter(Group.name == data.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Group '{data.name}' already exists",
            )
        group.name = data.name

    if data.description is not None:
        group.description = data.description

    db.commit()
    db.refresh(group)

    AuditService.log(
        db,
        actor=current_user.username,
        action="update",
        resource_type="group",
        resource_id=str(group.id),
        detail={"name": group.name},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return _group_to_response(group)


@router.delete("/groups/{id}", response_model=MessageResponse)
def delete_group(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    group = db.query(Group).filter(Group.id == id).first()
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Group {id} not found")

    group_name = group.name
    db.delete(group)
    db.commit()

    AuditService.log(
        db,
        actor=current_user.username,
        action="delete",
        resource_type="group",
        resource_id=str(id),
        detail={"name": group_name},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return MessageResponse(message=f"Group '{group_name}' deleted successfully")


# -----------------------------------------------------------------------------
# Users Endpoints
# -----------------------------------------------------------------------------


@router.get("/", response_model=list[UserResponse])
def list_users(
    source: str | None = Query(default=None),
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[User]:
    return UserService.list_users(db, source=source)


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> User:
    valid, msg = validate_password_policy(data.password)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    try:
        user = UserService.create_user(db, data)
        AuditService.log(
            db,
            actor=current_user.username,
            action="create",
            resource_type="user",
            resource_id=str(user.id),
            detail={"username": user.username, "role": user.role},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return user
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/{id}", response_model=UserResponse)
def get_user(
    id: int,
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> User:
    try:
        return UserService.get_user(db, id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/{id}", response_model=UserResponse)
def update_user(
    id: int,
    data: UserUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> User:
    if current_user.role != "admin" and current_user.id != id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot update other users",
        )

    if current_user.role != "admin" and data.role is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot change user role",
        )

    if data.password:
        valid, msg = validate_password_policy(data.password)
        if not valid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    try:
        update_data = data.model_dump(exclude_unset=True)
        updated_user = UserService.update_user(db, id, update_data)
        AuditService.log(
            db,
            actor=current_user.username,
            action="update",
            resource_type="user",
            resource_id=str(updated_user.id),
            detail={"updated_fields": list(update_data.keys())},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return updated_user
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{id}", response_model=MessageResponse)
def delete_user(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    if current_user.id == id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete own user account",
        )

    try:
        UserService.delete_user(db, id)
        AuditService.log(
            db,
            actor=current_user.username,
            action="delete",
            resource_type="user",
            resource_id=str(id),
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return MessageResponse(message=f"User {id} deleted successfully")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# -----------------------------------------------------------------------------
# User Group Membership Endpoints
# -----------------------------------------------------------------------------


@router.post("/{id}/groups/{group_id}", response_model=MessageResponse)
def add_user_to_group(
    id: int,
    group_id: int,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        UserService.add_user_to_group(db, id, group_id)
        AuditService.log(
            db,
            actor=current_user.username,
            action="add_to_group",
            resource_type="user",
            resource_id=str(id),
            detail={"group_id": group_id},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return MessageResponse(message=f"User {id} added to group {group_id}")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.delete("/{id}/groups/{group_id}", response_model=MessageResponse)
def remove_user_from_group(
    id: int,
    group_id: int,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        UserService.remove_user_from_group(db, id, group_id)
        AuditService.log(
            db,
            actor=current_user.username,
            action="remove_from_group",
            resource_type="user",
            resource_id=str(id),
            detail={"group_id": group_id},
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return MessageResponse(message=f"User {id} removed from group {group_id}")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
