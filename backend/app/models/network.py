from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class NetworkInterface(Base):
    __tablename__ = "network_interfaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    interface_type: Mapped[str] = mapped_column(String(20), nullable=False)
    ipv4_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    ipv4_netmask: Mapped[str | None] = mapped_column(String(45), nullable=True)
    ipv6_address: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gateway: Mapped[str | None] = mapped_column(String(45), nullable=True)
    dns_servers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    mtu: Mapped[int] = mapped_column(Integer, default=1500, nullable=False)
    dhcp: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    state: Mapped[str] = mapped_column(String(10), default="down", nullable=False)
    speed: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mac_address: Mapped[str | None] = mapped_column(String(17), nullable=True)
    parent: Mapped[str | None] = mapped_column(String(50), nullable=True)
    members: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class SystemConfig(Base):
    __tablename__ = "system_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    value: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cert_type: Mapped[str] = mapped_column(String(20), nullable=False)
    certificate: Mapped[str | None] = mapped_column(Text, nullable=True)
    private_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    csr: Mapped[str | None] = mapped_column(Text, nullable=True)
    issuer: Mapped[str | None] = mapped_column(String(500), nullable=True)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    san: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    acme_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
