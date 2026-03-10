from pydantic import BaseModel
from datetime import datetime

class UserProgressCreate(BaseModel):
    user_id: int
    invader_id: int
    captured: bool = True

class UserProgressOut(BaseModel):
    id: int
    user_id: int
    invader_id: int
    captured: bool
    timestamp: datetime

    class Config:
        from_attributes = True