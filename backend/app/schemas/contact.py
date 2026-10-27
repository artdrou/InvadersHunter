from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class ContactRequest(BaseModel):
    subject: str = Field(..., min_length=3, max_length=120)
    message: str = Field(..., min_length=10, max_length=4000)
    # Guests only (signed-in users are answered at their account's address)
    email: Optional[EmailStr] = None
    app_version: Optional[str] = Field(None, max_length=40)
    platform: Optional[str] = Field(None, max_length=20)
