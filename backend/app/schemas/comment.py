from pydantic import BaseModel, Field
from datetime import datetime


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=500)


class CommentOut(BaseModel):
    id: int
    invader_id: int
    user_id: int
    username: str
    body: str
    # "visible" | "hidden" | "pending_review" — the poster's client uses this
    # to explain when a comment was auto-hidden by moderation
    status: str
    created_at: datetime
