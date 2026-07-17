"""
Schemas for the /account endpoints — guest → account data migration (claim).
"""
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

from .user_progress import UserProgressOut
from .custom_invader import CustomInvaderBase, CustomInvaderOut


class ClaimCapture(BaseModel):
    invader_id: int
    # Preserved from the guest's local capture; server time when absent
    found_at: Optional[datetime] = None


class ClaimCustomInvader(CustomInvaderBase):
    # The temporary negative id the guest's row carries locally. Echoed back in
    # the response so the client can rewrite its rows onto the real server ids.
    local_id: int


class ClaimRequest(BaseModel):
    captures: List[ClaimCapture] = []
    custom_invaders: List[ClaimCustomInvader] = []


class ClaimedCustomInvader(BaseModel):
    """Pairs the guest's temporary local id with the row that replaced it."""
    local_id: int
    invader: CustomInvaderOut


class ClaimResponse(BaseModel):
    # Canonical rows created server-side — the client replaces its local guest
    # rows with these (real ids, authoritative timestamps)
    captures: List[UserProgressOut]
    imported: int
    skipped_duplicates: int
    skipped_missing: int
    # Empty for clients that predate custom invaders — they never send any.
    custom_invaders: List[ClaimedCustomInvader] = []
