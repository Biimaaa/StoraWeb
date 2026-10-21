from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ScheduledTaskCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    task_type: str = Field(min_length=1)
    schedule: str = Field(min_length=1)
    config: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class ScheduledTaskUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    task_type: str | None = None
    schedule: str | None = None
    config: dict[str, Any] | None = None
    enabled: bool | None = None


class ScheduledTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    task_type: str
    schedule: str
    config: dict[str, Any] = Field(default_factory=dict)
    enabled: bool
    last_run: datetime | None = None
    next_run: datetime | None = None
    last_result: str | None = None
    created_at: datetime


class SnapshotPolicyCreate(BaseModel):
    dataset_ids: list[int] = Field(min_length=1)
    schedule: str = Field(min_length=1)
    retention: dict[str, int] = Field(
        description="Keys: hourly, daily, weekly, monthly with count values"
    )
    naming_schema: str | None = None
    recursive: bool = False


class ReplicationTaskCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    source_dataset_id: int
    direction: str = Field(pattern=r"^(push|pull)$")
    transport: str = Field(pattern=r"^(ssh|local)$")
    target_host: str = Field(min_length=1)
    target_port: int = Field(default=22, ge=1, le=65535)
    target_dataset: str = Field(min_length=1)
    recursive: bool = False
    incremental: bool = True
    schedule: str = Field(min_length=1)
    retention_policy: str = Field(default="source", pattern=r"^(source|custom|none)$")
    retention_count: int = Field(default=10, ge=1)
    enabled: bool = True


class ReplicationTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    source_dataset_id: int
    direction: str
    transport: str
    target_host: str
    target_port: int
    target_dataset: str
    recursive: bool
    incremental: bool
    schedule: str
    retention_policy: str
    retention_count: int
    enabled: bool
    last_run: datetime | None = None
    last_result: str | None = None
    last_snapshot: str | None = None
    created_at: datetime
