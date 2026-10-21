from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Pool(Base):
    __tablename__ = "pools"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    topology: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="ONLINE", nullable=False)
    total_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    used_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    free_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fragmentation: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    health: Mapped[str] = mapped_column(String(50), default="ONLINE", nullable=False)
    scrub_schedule: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_scrub: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    scrub_errors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    autotrim: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    datasets: Mapped[list["Dataset"]] = relationship(back_populates="pool")
    disks: Mapped[list["Disk"]] = relationship(back_populates="pool")


class Disk(Base):
    __tablename__ = "disks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_name: Mapped[str] = mapped_column(String(50), nullable=False)
    serial: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    model: Mapped[str] = mapped_column(String(255), nullable=False)
    capacity_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    disk_type: Mapped[str] = mapped_column(String(20), nullable=False)
    temperature: Mapped[int | None] = mapped_column(Integer, nullable=True)
    smart_status: Mapped[str] = mapped_column(String(20), default="UNKNOWN", nullable=False)
    smart_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pool_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("pools.id", ondelete="SET NULL"), nullable=True
    )
    role: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="ONLINE", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    pool: Mapped["Pool | None"] = relationship(back_populates="disks")


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    path: Mapped[str] = mapped_column(String(1024), unique=True, nullable=False)
    pool_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("pools.id", ondelete="CASCADE"), nullable=False
    )
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=True
    )
    dataset_type: Mapped[str] = mapped_column(String(20), default="filesystem", nullable=False)
    preset: Mapped[str | None] = mapped_column(String(50), nullable=True)
    compression: Mapped[str] = mapped_column(String(20), default="lz4", nullable=False)
    dedup: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sync_mode: Mapped[str] = mapped_column(String(20), default="standard", nullable=False)
    record_size: Mapped[str] = mapped_column(String(10), default="128K", nullable=False)
    atime: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    quota_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reservation_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    used_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    available_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    encryption: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    encryption_algorithm: Mapped[str | None] = mapped_column(String(50), nullable=True)
    key_format: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mountpoint: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    readonly: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    pool: Mapped["Pool"] = relationship(back_populates="datasets")
    parent: Mapped["Dataset | None"] = relationship(
        back_populates="children", remote_side=[id]
    )
    children: Mapped[list["Dataset"]] = relationship(back_populates="parent")
    snapshots: Mapped[list["Snapshot"]] = relationship(back_populates="dataset")
    shares: Mapped[list["Share"]] = relationship(back_populates="dataset")


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    dataset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(1024), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    referenced_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    hold: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    immutable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)

    dataset: Mapped["Dataset"] = relationship(back_populates="snapshots")
