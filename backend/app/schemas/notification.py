from pydantic import BaseModel
from typing import Literal, Optional
from datetime import datetime

Language = Literal["fr", "en"]


class PushTokenRegister(BaseModel):
    token: str
    platform: Optional[str] = None  # "ios" | "android"


class PushTokenOut(BaseModel):
    id: int
    token: str
    platform: Optional[str] = None

    class Config:
        from_attributes = True


class UserNotificationPrefsOut(BaseModel):
    notifications_enabled: bool
    language: Language


class UserNotificationPrefsUpdate(BaseModel):
    notifications_enabled: Optional[bool] = None
    language: Optional[Language] = None


class NotificationSettingsOut(BaseModel):
    enabled: bool
    notify_on_create: bool
    notify_on_update: bool
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NotificationSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    notify_on_create: Optional[bool] = None
    notify_on_update: Optional[bool] = None
