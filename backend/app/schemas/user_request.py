from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from datetime import datetime
from ..core.name_utils import normalize_name, validate_name_format


class UserRequestCreate(BaseModel):
    request_type: Literal["create", "modify"]
    invader_id: Optional[int] = None  # required for "modify"
    proposed_name: str
    proposed_description: Optional[str] = None
    proposed_latitude: Optional[float] = None
    proposed_longitude: Optional[float] = None
    proposed_points: Optional[int] = None
    proposed_state: Optional[str] = None
    proposed_image_url: Optional[str] = None

    @field_validator("proposed_name")
    @classmethod
    def name_must_be_valid(cls, v: str) -> str:
        normalized = normalize_name(v)
        if not validate_name_format(normalized):
            raise ValueError(
                f"Name '{v}' does not match the required format CITYCODE_NUMBER "
                f"(e.g. PA_10, LYO_3). Normalized form: '{normalized}'"
            )
        return v

    @field_validator("invader_id")
    @classmethod
    def check_invader_id(cls, v, info):
        # invader_id is validated in the route against request_type
        return v


class UserRequestOut(BaseModel):
    id: int
    user_id: int
    invader_id: Optional[int]
    request_type: str
    status: str
    proposed_name: Optional[str]
    normalized_name: Optional[str]
    proposed_description: Optional[str]
    proposed_latitude: Optional[float]
    proposed_longitude: Optional[float]
    proposed_points: Optional[int]
    proposed_state: Optional[str]
    proposed_image_url: Optional[str]
    admin_request_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
