from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    actor: str
    action: str
    resource_type: str
    resource_id: str | None = None
    detail: dict[str, Any] | None = None
    ip_address: str | None = None
    user_agent: str | None = None


class AuditLogFilter(BaseModel):
    actor: str | None = None
    action: str | None = None
    resource_type: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=500)
