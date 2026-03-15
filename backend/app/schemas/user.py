from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional

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