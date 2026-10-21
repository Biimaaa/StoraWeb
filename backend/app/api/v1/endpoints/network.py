from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import get_current_active_user, get_db, require_role
from app.models.network import Certificate, NetworkInterface
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.system import (
    CertificateCreate,
    CertificateResponse,
    NetworkInterfaceResponse,
    NetworkInterfaceUpdate,
)
from app.services.audit import AuditService
from app.services.network import NetworkService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["network"])


class DNSUpdateRequest(BaseModel):
    servers: list[str] = Field(default_factory=list)
    domain: str = ""


class HostnameUpdateRequest(BaseModel):
    hostname: str = Field(min_length=1, max_length=253)


def _iface_to_response(iface: NetworkInterface) -> NetworkInterfaceResponse:
    dns_list: list[str] = []
    if isinstance(iface.dns_servers, list):
        dns_list = [str(x) for x in iface.dns_servers]
    elif isinstance(iface.dns_servers, dict):
        dns_list = [str(x) for x in iface.dns_servers.get("servers", [])]

    return NetworkInterfaceResponse(
        id=iface.id,
        name=iface.name,
        interface_type=iface.interface_type,
        ipv4_address=iface.ipv4_address,
        ipv4_netmask=iface.ipv4_netmask,
        gateway=iface.gateway,
        dns_servers=dns_list,
        mtu=iface.mtu,
        dhcp=iface.dhcp,
        state=iface.state,
        speed=iface.speed,
        mac_address=iface.mac_address,
        created_at=iface.created_at,
    )


def _cert_to_response(cert: Certificate) -> CertificateResponse:
    san_list: list[str] = []
    if isinstance(cert.san, list):
        san_list = [str(s) for s in cert.san]
    elif isinstance(cert.san, dict):
        for v in cert.san.values():
            if isinstance(v, list):
                san_list.extend(str(item) for item in v)
            elif v:
                san_list.append(str(v))

    return CertificateResponse(
        id=cert.id,
        name=cert.name,
        cert_type=cert.cert_type,
        issuer=cert.issuer,
        valid_from=cert.valid_from,
        valid_until=cert.valid_until,
        san=san_list,
        is_default=cert.is_default,
        created_at=cert.created_at,
    )


# -----------------------------------------------------------------------------
# Interface Routes
# -----------------------------------------------------------------------------


@router.get("/interfaces", response_model=list[NetworkInterfaceResponse])
def list_interfaces(
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[NetworkInterfaceResponse]:
    interfaces = NetworkService.list_interfaces(db)
    if not interfaces:
        interfaces = NetworkService.scan_interfaces(db)
    return [_iface_to_response(i) for i in interfaces]


@router.post("/interfaces/scan", response_model=list[NetworkInterfaceResponse])
def scan_interfaces(
    request: Request,
    current_user: User = Depends(require_role("admin", "operator")),
    db: Session = Depends(get_db),
) -> list[NetworkInterfaceResponse]:
    interfaces = NetworkService.scan_interfaces(db)
    AuditService.log(
        db,
        actor=current_user.username,
        action="scan_interfaces",
        resource_type="network",
        detail={"count": len(interfaces)},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return [_iface_to_response(i) for i in interfaces]


@router.get("/interfaces/{id}", response_model=NetworkInterfaceResponse)
def get_interface(
    id: int,
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> NetworkInterfaceResponse:
    try:
        iface = NetworkService.get_interface(db, id)
        return _iface_to_response(iface)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.put("/interfaces/{id}", response_model=NetworkInterfaceResponse)
def update_interface(
    id: int,
    data: NetworkInterfaceUpdate,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> NetworkInterfaceResponse:
    try:
        update_data = data.model_dump(exclude_unset=True)
        iface = NetworkService.update_interface(db, id, update_data)
        AuditService.log(
            db,
            actor=current_user.username,
            action="update",
            resource_type="interface",
            resource_id=str(id),
            detail=update_data,
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return _iface_to_response(iface)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# -----------------------------------------------------------------------------
# DNS Routes
# -----------------------------------------------------------------------------


@router.get("/dns")
def get_dns(
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return NetworkService.get_dns_config(db=db)


@router.put("/dns", response_model=MessageResponse)
def update_dns(
    data: DNSUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    NetworkService.set_dns_config(servers=data.servers, domain=data.domain, db=db)
    AuditService.log(
        db,
        actor=current_user.username,
        action="update_dns",
        resource_type="network",
        detail={"servers": data.servers, "domain": data.domain},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return MessageResponse(message="DNS configuration updated successfully")


# -----------------------------------------------------------------------------
# Hostname Routes
# -----------------------------------------------------------------------------


@router.get("/hostname")
def get_hostname(
    _: User = Depends(get_current_active_user),
) -> dict[str, str]:
    return {"hostname": NetworkService.get_hostname()}


@router.put("/hostname", response_model=MessageResponse)
def update_hostname(
    data: HostnameUpdateRequest,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    NetworkService.set_hostname(data.hostname, db=db)
    AuditService.log(
        db,
        actor=current_user.username,
        action="update_hostname",
        resource_type="network",
        detail={"hostname": data.hostname},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return MessageResponse(message=f"Hostname set to '{data.hostname}' successfully")


# -----------------------------------------------------------------------------
# Certificates Routes
# -----------------------------------------------------------------------------


@router.get("/certificates", response_model=list[CertificateResponse])
def list_certificates(
    _: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[CertificateResponse]:
    certs = NetworkService.list_certificates(db)
    return [_cert_to_response(c) for c in certs]


@router.post("/certificates", response_model=CertificateResponse, status_code=status.HTTP_201_CREATED)
def create_certificate(
    data: CertificateCreate,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> CertificateResponse:
    cert = NetworkService.create_certificate(db, data.model_dump())
    AuditService.log(
        db,
        actor=current_user.username,
        action="create",
        resource_type="certificate",
        resource_id=str(cert.id),
        detail={"name": cert.name, "cert_type": cert.cert_type},
        ip_address=request.client.host if request.client else "127.0.0.1",
    )
    return _cert_to_response(cert)


@router.delete("/certificates/{id}", response_model=MessageResponse)
def delete_certificate(
    id: int,
    request: Request,
    current_user: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> MessageResponse:
    try:
        NetworkService.delete_certificate(db, id)
        AuditService.log(
            db,
            actor=current_user.username,
            action="delete",
            resource_type="certificate",
            resource_id=str(id),
            ip_address=request.client.host if request.client else "127.0.0.1",
        )
        return MessageResponse(message=f"Certificate {id} deleted successfully")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
