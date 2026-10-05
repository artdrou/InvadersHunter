from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.environment import environment_for_host
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
    request: Request,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    saved = notification_service.register_token(
        db, current_user.id, body.token, body.platform,
        app_variant=body.app_variant,
        server_env=environment_for_host(request.headers.get("host")),
    )
    if saved is None:
        return {"message": "Token ignored: app from another environment"}
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
    return UserNotificationPrefsOut(
        notifications_enabled=current_user.notifications_enabled,
        language=current_user.language,
    )


@router.patch("/me", response_model=UserNotificationPrefsOut)
def update_my_notification_prefs(
    body: UserNotificationPrefsUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user = notification_service.update_user_prefs(db, current_user, body.model_dump())
    return UserNotificationPrefsOut(notifications_enabled=user.notifications_enabled, language=user.language)


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
