from pydantic import BaseModel, Field, StringConstraints
from typing import Annotated, Literal, Optional, Union

HEX = r"^#[0-9a-fA-F]{6}$"
# Profile-only silhouettes ("small-1", "big-3"…), listed by the app: any such id is
# accepted so new ones ship with an app update only (older apps draw the default)
EXTRA_SHAPE = r"^[a-z]+-[0-9]{1,3}$"


class Avatar(BaseModel):
    """Profile icon, drawn by the app like a map marker: an invader silhouette
    (`shape` = a point tier or a profile-only id), its color, glow color and glow preset (0..8)."""
    shape: Union[Literal[10, 20, 30, 40, 50, 100], Annotated[str, StringConstraints(pattern=EXTRA_SHAPE)]] = Field(
        ..., union_mode="left_to_right",
    )
    icon: str = Field(..., pattern=HEX)
    glow: str = Field(..., pattern=HEX)
    bloom: int = Field(..., ge=0, le=8)


class AvatarBody(BaseModel):
    """Read and write my icon; `avatar: null` = the default icon."""
    avatar: Optional[Avatar] = None
