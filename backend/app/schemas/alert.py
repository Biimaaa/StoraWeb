from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    level: str
    source: str
    message: str
    detail: str | None = None
    dismissed: bool = False
    dismissed_by: str | None = None
    dismissed_at: datetime | None = None
    created_at: datetime


class AlertDismiss(BaseModel):
    dismissed_by: str = Field(min_length=1)


class NotificationChannelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    channel_type: str = Field(pattern=r"^(email|webhook|telegram|slack)$")
    config: dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True
    min_level: str = Field(default="warning", pattern=r"^(info|warning|error|critical)$")


class NotificationChannelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    channel_type: str | None = Field(default=None, pattern=r"^(email|webhook|telegram|slack)$")
    config: dict[str, Any] | None = None
    enabled: bool | None = None
    min_level: str | None = Field(default=None, pattern=r"^(info|warning|error|critical)$")


class NotificationChannelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    channel_type: str
    config: dict[str, Any] = Field(default_factory=dict)
    enabled: bool
    min_level: str
    created_at: datetime
