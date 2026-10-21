from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    per_page: int = Field(ge=1)
    pages: int = Field(ge=0)


class MessageResponse(BaseModel):
    message: str
    detail: str | None = None


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
    code: int


class BulkDeleteRequest(BaseModel):
    ids: list[int] = Field(min_length=1)
    confirm: bool


class ConfirmDestructive(BaseModel):
    confirm_name: str = Field(min_length=1)
