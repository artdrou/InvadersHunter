from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=500)


class ReactionRequest(BaseModel):
    # 1 = like, -1 = dislike, 0 = clear the caller's reaction
    value: int = Field(ge=-1, le=1)


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
    likes: int = 0
    dislikes: int = 0
    # the caller's own reaction: 1 like / -1 dislike / 0 none (0 when anonymous)
    my_reaction: int = 0


class CommentSummaryOut(BaseModel):
    # number of listed comments (visible + pending_review) for the invader
    count: int
    # most-liked comment, shown on the map popup; None when nothing has likes yet
    top: Optional[CommentOut] = None
