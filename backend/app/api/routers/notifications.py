from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, require_admin
from app.schemas.notification import (
    PushTokenRegister,
    UserNotificationPrefsOut,
    UserNotificationPrefsUpdate,
    NotificationSettingsOut,
    NotificationSettingsUpdate,
)
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.post("/push-token")
def register_push_token(
    body: PushTokenRegister,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    notification_service.register_token(db, current_user.id, body.token, body.platform)
    return {"message": "Token registered"}


@router.delete("/push-token/{token}")
def unregister_push_token(
    token: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    notification_service.unregister_token(db, token)
    return {"message": "Token unregistered"}


@router.get("/me", response_model=UserNotificationPrefsOut)
def get_my_notification_prefs(current_user=Depends(get_current_user)):
    return UserNotificationPrefsOut(notifications_enabled=current_user.notifications_enabled)


@router.patch("/me", response_model=UserNotificationPrefsOut)
def update_my_notification_prefs(
    body: UserNotificationPrefsUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user = notification_service.update_user_prefs(db, current_user, body.notifications_enabled)
    return UserNotificationPrefsOut(notifications_enabled=user.notifications_enabled)


@router.get("/settings", response_model=NotificationSettingsOut)
def get_global_notification_settings(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return notification_service.get_global_settings(db)


@router.patch("/settings", response_model=NotificationSettingsOut)
def update_global_notification_settings(
    body: NotificationSettingsUpdate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return notification_service.update_global_settings(db, admin, body.model_dump())
