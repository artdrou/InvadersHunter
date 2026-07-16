"""
Schemas for the /account endpoints — guest → account data migration (claim).
"""
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

from .user_progress import UserProgressOut


class ClaimCapture(BaseModel):
    invader_id: int
    # Preserved from the guest's local capture; server time when absent
    found_at: Optional[datetime] = None


class ClaimRequest(BaseModel):
    captures: List[ClaimCapture] = []
    # Extension point: custom_invaders will be added by the custom-invaders feature


class ClaimResponse(BaseModel):
    # Canonical rows created server-side — the client replaces its local guest
    # rows with these (real ids, authoritative timestamps)
    captures: List[UserProgressOut]
    imported: int
    skipped_duplicates: int
    skipped_missing: int
