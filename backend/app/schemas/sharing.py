from datetime import datetime
from typing import Annotated, Union

from pydantic import BaseModel, ConfigDict, Discriminator, Field, Tag, computed_field


class SMBSettings(BaseModel):
    guest_ok: bool = False
    readonly: bool = False
    browsable: bool = True
    recycle_bin: bool = True
    time_machine: bool = False
    allowed_users: list[str] | None = None
    denied_users: list[str] | None = None


class NFSSettings(BaseModel):
    hosts: list[str] = Field(default_factory=lambda: ["*"])
    maproot_user: str | None = None
    maproot_group: str | None = None
    security: list[str] = Field(default_factory=lambda: ["sys"])
    nfsv4: bool = True


def _settings_discriminator(v: dict | BaseModel) -> str:
    if isinstance(v, dict):
        if "guest_ok" in v or "browsable" in v or "recycle_bin" in v or "time_machine" in v:
            return "smb"
        if "hosts" in v or "nfsv4" in v or "maproot_user" in v:
            return "nfs"
        return "smb"
    if isinstance(v, SMBSettings):
        return "smb"
    return "nfs"


ShareSettings = Annotated[
    Union[
        Annotated[SMBSettings, Tag("smb")],
        Annotated[NFSSettings, Tag("nfs")],
    ],
    Discriminator(_settings_discriminator),
]


class ShareCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    protocol: str = Field(pattern=r"^(smb|nfs)$")
    dataset_id: int
    path: str | None = None
    enabled: bool = True
    settings: SMBSettings | NFSSettings


class ShareUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    protocol: str | None = Field(default=None, pattern=r"^(smb|nfs)$")
    dataset_id: int | None = None
    path: str | None = None
    enabled: bool | None = None
    settings: SMBSettings | NFSSettings | None = None


class ShareResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    protocol: str
    dataset_id: int
    path: str | None = None
    enabled: bool
    settings: dict | None = None
    created_at: datetime

    @computed_field
    @property
    def network_path(self) -> str:
        if self.protocol == "smb":
            return f"\\\\server\\{self.name}"
        return f"server:{self.path or '/'}"
