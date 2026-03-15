from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserProgressCreate(BaseModel):
    user_id: int
    invader_id: int
    found_at: Optional[datetime] = None

class UserProgressUpdate(BaseModel):
    user_id: Optional[int] = None
    invader_id: Optional[int] = None
    found_at: Optional[datetime] = None

class UserProgressOut(BaseModel):
    id: int
    user_id: int
    invader_id: int
    found_at: datetime

    class Config:
        from_attributes = True