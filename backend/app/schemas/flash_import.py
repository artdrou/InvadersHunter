"""Flash Import feature — Pydantic I/O schemas."""
from typing import List, Optional
from pydantic import BaseModel, Field


class FlashImportRequest(BaseModel):
    names: List[str] = Field(
        ...,
        description="Raw invader names or filenames (extensions stripped server-side)",
        min_length=1,
        max_length=10000,
    )
    mirror: bool = Field(False, description="Also remove the account's flashes the phone doesn't list")
    confirm: bool = Field(False, description="Mirror only: apply. Without it, a preview that writes nothing")


class FlashImportResponse(BaseModel):
    username: str
    app_total: int                  # account flashes before this import
    phone_total: int                # known invaders the phone lists
    imported: int                   # added (or, in a mirror preview, to add)
    already_flashed: int
    unknown: List[str]
    total_submitted: int
    mirror: bool = False
    applied: bool = True            # False for a mirror preview: nothing written
    to_remove: List[str] = []       # mirror: account flashes the phone doesn't list
    removed: int = 0
    refused: Optional[str] = None   # mirror preview: why it would be refused
