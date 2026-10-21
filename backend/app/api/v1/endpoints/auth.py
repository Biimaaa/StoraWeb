from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db
from app.core.security import create_access_token, validate_password_policy
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.user import PasswordChange, Token, UserLogin, UserResponse
from app.services.audit import AuditService
from app.services.user import UserService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["auth"])


class TOTPVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


@router.post("/token", response_model=Token)
async def login_for_access_token(
    request: Request,
    db: Session = Depends(get_db),
) -> Token:
    content_type = request.headers.get("content-type", "")
    username = ""
    password = ""

    if "application/json" in content_type:
        try:
            body = await request.json()
            username = body.get("username", "")
            password = body.get("password", "")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload",
            )
    else:
        try:
            form = await request.form()
            username = str(form.get("username", ""))
            password = str(form.get("password", ""))
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid form data",
            )

    client_ip = request.client.host if request.client else "127.0.0.1"
    user = UserService.authenticate(db, username, password)
    if not user:
        AuditService.log(
            db,
            actor=username or "anonymous",
            action="login",
            resource_type="auth",
            resource_id=None,
            ip_address=client_ip,
            result="failed",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    AuditService.log(
        db,
        actor=user.username,
        action="login",
        resource_type="auth",
        resource_id=str(user.id),
        ip_address=client_ip,
        result="success",
    )

    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return Token(access_token=access_token, token_type="bearer")


@router.post("/login", response_model=Token)
def login_json(
    request: Request,
    credentials: UserLogin,
    db: Session = Depends(get_db),
) -> Token:
    client_ip = request.client.host if request.client else "127.0.0.1"
    user = UserService.authenticate(db, credentials.username, credentials.password)
    if not user:
        AuditService.log(
            db,
            actor=credentials.username,
            action="login",
            resource_type="auth",
            resource_id=None,
            ip_address=client_ip,
            result="failed",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    AuditService.log(
        db,
        actor=user.username,
        action="login",
        resource_type="auth",
        resource_id=str(user.id),
        ip_address=client_ip,
        result="success",
    )

    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
def get_current_user_details(
    current_user: User = Depends(get_current_active_user),
) -> User:
    return current_user


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    data: PasswordChange,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    valid, msg = validate_password_policy(data.new_password)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    try:
        UserService.change_password(db, current_user.id, data.current_password, data.new_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    AuditService.log(
        db,
        actor=current_user.username,
        action="change_password",
        resource_type="user",
        resource_id=str(current_user.id),
        ip_address=request.client.host if request.client else "127.0.0.1",
        result="success",
    )
    return MessageResponse(message="Password changed successfully")


@router.post("/totp/setup")
def setup_totp(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    try:
        return UserService.setup_totp(db, current_user.id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/totp/verify")
def verify_totp(
    body: TOTPVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    valid = UserService.verify_totp(db, current_user.id, body.code)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP verification code",
        )
    return {"valid": True, "message": "TOTP verified and enabled successfully"}
