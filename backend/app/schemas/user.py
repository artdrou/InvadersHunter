from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

# Received data to create user
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)

# Data received in responses
class UserOut(BaseModel):
    id: int
    username: str
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True