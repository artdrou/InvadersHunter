from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import List, Optional

# Received data to create user
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=4)

class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=4)
    is_admin: Optional[bool] = None

# Data received in responses
class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserAdminProfileOut(BaseModel):
    """Admin-only view of one user: account, key dates, contributions, flashes."""
    id: int
    username: str
    email: str
    is_admin: bool
    language: str
    notifications_enabled: bool
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None
    first_flash_at: Optional[datetime] = None
    last_flash_at: Optional[datetime] = None
    last_request_at: Optional[datetime] = None
    requests_sent: int
    requests_accepted: int
    requests_rejected: int
    requests_pending: int
    comments: int
    flashed_invader_ids: List[int]
