from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional


class FriendRequestCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)


class FriendEntry(BaseModel):
    """One row of the Social tab: a friend, or an invite received / sent.
    `id` is the friendship id (used to accept / decline / cancel / remove)."""
    id: int
    user_id: int
    username: str
    flashed_count: int
    since: Optional[datetime] = None


class FriendsOverview(BaseModel):
    friends: List[FriendEntry]
    incoming: List[FriendEntry]
    outgoing: List[FriendEntry]


class FriendRequestResult(BaseModel):
    """`accepted` is true when the other user had already invited you: the
    invite is accepted on the spot instead of creating a second one."""
    id: int
    status: str
    accepted: bool


class FriendProfileOut(BaseModel):
    """What a friend can see of you: game stats only (no email, language,
    notification setting or login date)."""
    id: int
    username: str
    created_at: Optional[datetime] = None
    first_flash_at: Optional[datetime] = None
    last_flash_at: Optional[datetime] = None
    requests_sent: int
    requests_accepted: int
    comments: int
    flashed_invader_ids: List[int]
