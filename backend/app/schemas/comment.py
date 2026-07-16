from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

from .admin_request import InvaderContributorsOut


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

    @classmethod
    def from_row(cls, comment, username: str, my_reaction: int = 0) -> "CommentOut":
        """Build from a comment ORM row + resolved author username + caller reaction."""
        return cls(
            id=comment.id,
            invader_id=comment.invader_id,
            user_id=comment.user_id,
            username=username,
            body=comment.body,
            status=comment.status,
            created_at=comment.created_at,
            likes=comment.likes,
            dislikes=comment.dislikes,
            my_reaction=my_reaction,
        )


class CommentSummaryOut(BaseModel):
    # number of listed comments (visible + pending_review) for the invader
    count: int
    # most-liked comment, shown on the map popup; None when nothing has likes yet
    top: Optional[CommentOut] = None

    @classmethod
    def from_service(cls, count: int, top_row) -> "CommentSummaryOut":
        """`top_row` is the (comment, username, my_reaction) tuple from
        comment_service.get_summary, or None."""
        return cls(count=count, top=CommentOut.from_row(*top_row) if top_row else None)


class InvaderOverviewOut(BaseModel):
    """Aggregated popup payload — contributors + comment summary in one request."""
    contributors: InvaderContributorsOut
    comments: CommentSummaryOut
