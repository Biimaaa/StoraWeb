from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PoolSummary(BaseModel):
    id: int
    name: str
    status: str
    health: str
    used_percent: float
    total_bytes: int
    used_bytes: int


class ServiceStatus(BaseModel):
    name: str
    status: str = Field(pattern=r"^(running|stopped|error)$")
    enabled: bool


class NetworkInterfaceSummary(BaseModel):
    name: str
    ipv4_address: str | None = None
    state: str
    speed: str | None = None


class DashboardResponse(BaseModel):
    hostname: str
    uptime_seconds: int
    cpu_usage: float
    memory_total: int
    memory_used: int
    memory_percent: float
    pools: list[PoolSummary] = Field(default_factory=list)
    alerts_active: int = 0
    services: list[ServiceStatus] = Field(default_factory=list)
    network_interfaces: list[NetworkInterfaceSummary] = Field(default_factory=list)


class SystemMetrics(BaseModel):
    timestamp: datetime
    cpu_percent: float
    memory_percent: float
    memory_used_bytes: int
    swap_percent: float
    load_avg: list[float] = Field(default_factory=list)
    disk_io: dict[str, Any] = Field(default_factory=dict)
    network_io: dict[str, Any] = Field(default_factory=dict)
    arc_stats: dict[str, Any] | None = None


class NetworkInterfaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    interface_type: str = Field(pattern=r"^(ethernet|bond|vlan|bridge)$")
    ipv4_address: str | None = None
    ipv4_netmask: str | None = None
    gateway: str | None = None
    dns_servers: list[str] = Field(default_factory=list)
    mtu: int = Field(default=1500, ge=68, le=9216)
    dhcp: bool = False


class NetworkInterfaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    interface_type: str | None = Field(default=None, pattern=r"^(ethernet|bond|vlan|bridge)$")
    ipv4_address: str | None = None
    ipv4_netmask: str | None = None
    gateway: str | None = None
    dns_servers: list[str] | None = None
    mtu: int | None = Field(default=None, ge=68, le=9216)
    dhcp: bool | None = None


class NetworkInterfaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    interface_type: str
    ipv4_address: str | None = None
    ipv4_netmask: str | None = None
    gateway: str | None = None
    dns_servers: list[str] = Field(default_factory=list)
    mtu: int
    dhcp: bool
    state: str | None = None
    speed: str | None = None
    mac_address: str | None = None
    created_at: datetime


class CertificateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    cert_type: str = Field(pattern=r"^(internal|imported|acme|csr)$")
    certificate: str | None = None
    private_key: str | None = None


class CertificateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    cert_type: str
    issuer: str | None = None
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    san: list[str] = Field(default_factory=list)
    is_default: bool = False
    created_at: datetime


class NetworkConfig(BaseModel):
    dhcp: bool = True
    ipv4_address: str | None = None
    ipv4_netmask: str | None = None
    gateway: str | None = None
    dns_servers: list[str] = Field(default_factory=list)


class SetupWizard(BaseModel):
    language: str = Field(default="id", min_length=2, max_length=10)
    timezone: str = Field(default="Asia/Jakarta")
    hostname: str = Field(min_length=1, max_length=253)
    network: NetworkConfig
    admin_password: str = Field(min_length=8, max_length=128)


class SystemConfigUpdate(BaseModel):
    key: str = Field(min_length=1)
    value: Any
