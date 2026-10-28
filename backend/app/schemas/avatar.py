from pydantic import BaseModel, Field
from typing import Literal, Optional

HEX = r"^#[0-9a-fA-F]{6}$"


class Avatar(BaseModel):
    """Profile icon, drawn by the app like a map marker: an invader silhouette
    (`shape` = one of the point tiers), its color, glow color and glow preset (0..8)."""
    shape: Literal[10, 20, 30, 40, 50, 100]
    icon: str = Field(..., pattern=HEX)
    glow: str = Field(..., pattern=HEX)
    bloom: int = Field(..., ge=0, le=8)


class AvatarBody(BaseModel):
    """Read and write my icon; `avatar: null` = the default icon."""
    avatar: Optional[Avatar] = None
