from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserBase(BaseModel):
    username: str = Field(min_length=2, max_length=100)
    full_name: str = Field(default="", max_length=255)
    email: EmailStr | None = None


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="readonly", pattern=r"^(admin|readonly|operator)$")


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=2, max_length=100)
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_active: bool | None = None
    role: str | None = Field(default=None, pattern=r"^(admin|readonly|operator)$")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    email: str | None = None
    is_active: bool
    role: str
    source: str
    totp_enabled: bool
    home_directory: str | None = None
    created_at: datetime
    updated_at: datetime


class UserLogin(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class GroupBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class GroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    source: str
    created_at: datetime
    member_count: int | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: str | None = None
    role: str | None = None


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)
