from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field


class VdevType(str, Enum):
    stripe = "stripe"
    mirror = "mirror"
    raidz1 = "raidz1"
    raidz2 = "raidz2"
    raidz3 = "raidz3"


class VdevPurpose(str, Enum):
    data = "data"
    cache = "cache"
    log = "log"
    spare = "spare"
    special = "special"


class VdevConfig(BaseModel):
    vdev_type: VdevType
    disk_ids: list[int] = Field(min_length=1)
    purpose: VdevPurpose = VdevPurpose.data


class PoolTopology(BaseModel):
    data: list[VdevConfig] = Field(min_length=1)
    cache: list[VdevConfig] | None = None
    log: list[VdevConfig] | None = None
    spare: list[VdevConfig] | None = None
    special: list[VdevConfig] | None = None


class DiskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_name: str
    serial: str | None = None
    model: str | None = None
    capacity_bytes: int
    disk_type: str | None = None
    temperature: int | None = None
    smart_status: str | None = None
    pool_id: int | None = None
    role: str | None = None
    status: str

    @computed_field
    @property
    def capacity_human(self) -> str:
        units = ["B", "KB", "MB", "GB", "TB", "PB"]
        size = float(self.capacity_bytes)
        for unit in units:
            if abs(size) < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} EB"


class PoolCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z][a-zA-Z0-9_-]*$")
    topology: PoolTopology
    encryption: bool = False


class PoolUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    scrub_schedule: str | None = None
    autotrim: bool | None = None


class PoolResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    topology: dict[str, Any] | None = None
    status: str
    total_bytes: int = 0
    used_bytes: int = 0
    free_bytes: int = 0
    fragmentation: int | None = None
    health: str
    scrub_schedule: str | None = None
    last_scrub: datetime | None = None
    scrub_errors: int | None = None
    autotrim: bool = False
    created_at: datetime

    @computed_field
    @property
    def used_percent(self) -> float:
        if self.total_bytes == 0:
            return 0.0
        return round((self.used_bytes / self.total_bytes) * 100, 2)

    @computed_field
    @property
    def disk_count(self) -> int:
        if not self.topology:
            return 0
        count = 0
        for vdevs in self.topology.values():
            if isinstance(vdevs, list):
                for vdev in vdevs:
                    if isinstance(vdev, dict) and "disk_ids" in vdev:
                        count += len(vdev["disk_ids"])
        return count


class DatasetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    pool_id: int
    parent_id: int | None = None
    dataset_type: str = Field(default="filesystem", pattern=r"^(filesystem|volume)$")
    preset: str | None = None
    compression: str = Field(default="lz4")
    dedup: bool = False
    sync_mode: str = Field(default="standard", pattern=r"^(standard|always|disabled)$")
    record_size: int = Field(default=131072, ge=512)
    quota_bytes: int | None = Field(default=None, ge=0)
    reservation_bytes: int | None = Field(default=None, ge=0)
    encryption: bool = False


class DatasetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    compression: str | None = None
    dedup: bool | None = None
    sync_mode: str | None = Field(default=None, pattern=r"^(standard|always|disabled)$")
    record_size: int | None = Field(default=None, ge=512)
    quota_bytes: int | None = Field(default=None, ge=0)
    reservation_bytes: int | None = Field(default=None, ge=0)


class DatasetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    path: str | None = None
    pool_id: int
    parent_id: int | None = None
    dataset_type: str
    preset: str | None = None
    compression: str
    dedup: bool
    sync_mode: str
    record_size: int
    quota_bytes: int | None = None
    reservation_bytes: int | None = None
    encryption: bool
    used_bytes: int = 0
    available_bytes: int = 0
    mountpoint: str | None = None
    created_at: datetime
    children_count: int = 0
    snapshot_count: int = 0
    shares: list[Any] = Field(default_factory=list)


class SnapshotCreate(BaseModel):
    dataset_id: int
    name: str | None = None


class SnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    dataset_id: int
    name: str
    size_bytes: int = 0
    referenced_bytes: int = 0
    created_at: datetime


class SnapshotRollback(BaseModel):
    confirm_name: str = Field(min_length=1)
