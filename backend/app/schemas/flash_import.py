"""Flash Import feature — Pydantic I/O schemas."""
from typing import List
from pydantic import BaseModel, Field


class FlashImportRequest(BaseModel):
    names: List[str] = Field(
        ...,
        description="Raw invader names or filenames (extensions stripped server-side)",
        min_length=1,
        max_length=10000,
    )


class FlashImportResponse(BaseModel):
    imported: int
    already_flashed: int
    unknown: List[str]
    total_submitted: int
