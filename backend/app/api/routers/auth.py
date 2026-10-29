from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.schemas.auth import (
    LoginRequest, TokenResponse, RefreshRequest,
    ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest, ChangePasswordRequest,
    VerifyEmailRequest, ResendVerificationRequest,
)
from app.core.client_ip import client_ip
from app.core.verify_page import verify_page
from app.dependencies import get_db, get_current_user
from app.services import auth_service
from app.services.auth_service import (
    InvalidCredentials, InvalidRefreshToken, InvalidResetCode, TooManyAttempts,
    EmailNotVerified, InvalidVerifyCode, AlreadyVerified,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.login(db, data.username, data.password)
    except InvalidCredentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    except EmailNotVerified:
        # The app opens its code screen on a 403; older apps and tools show this text
        raise HTTPException(status_code=403, detail=(
            "Confirme ton email avec le lien reçu, puis reconnecte-toi. / "
            "Confirm your email with the link we sent, then log in again."))
    except TooManyAttempts:
        raise HTTPException(status_code=429, detail="too_many")


@router.post("/verify-email", response_model=TokenResponse)
def verify_email(data: VerifyEmailRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Email-check code typed in the app: activates the account and logs it in."""
    try:
        return auth_service.verify_email(db, data.username, data.code, schedule=background_tasks.add_task)
    except InvalidVerifyCode:
        raise HTTPException(status_code=400, detail="invalid_code")
    except AlreadyVerified:
        raise HTTPException(status_code=400, detail="already_verified")
    except TooManyAttempts:
        raise HTTPException(status_code=429, detail="too_many")


@router.get("/verify-email", response_class=HTMLResponse)
def verify_email_link(username: str, code: str, background_tasks: BackgroundTasks,
                      db: Session = Depends(get_db)):
    """Link in the verification email, opened in a browser."""
    outcome, language = auth_service.verify_email_link(db, username, code, schedule=background_tasks.add_task)
    return HTMLResponse(verify_page(outcome, language), status_code=200 if outcome in ("ok", "already") else 400)


@router.post("/resend-verification")
def resend_verification(data: ResendVerificationRequest, background_tasks: BackgroundTasks,
                        db: Session = Depends(get_db)):
    send = auth_service.resend_verification(db, data.username)
    if send:
        background_tasks.add_task(send)
    # Same reply whatever happened: doesn't tell which accounts exist
    return {"message": "If this account needs it, a new code has been sent"}


@router.post("/guest")
def guest(request: Request):
    """Guest mode: an anonymous pass that opens the invader catalog (no account)."""
    try:
        return auth_service.guest_pass(client_ip(request))
    except TooManyAttempts:
        raise HTTPException(status_code=429, detail="too_many")


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.refresh(db, data.refresh_token)
    except InvalidRefreshToken:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")


@router.post("/logout")
def logout(data: RefreshRequest, db: Session = Depends(get_db)):
    auth_service.logout(db, data.refresh_token)
    return {"message": "Logged out"}


@router.post("/change-password")
def change_password(data: ChangePasswordRequest, background_tasks: BackgroundTasks,
                    db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    # `detail` codes are stable: the app maps them to translated messages.
    try:
        auth_service.change_password(db, current_user, data.current_password, data.new_password,
                                     schedule=background_tasks.add_task)
    except InvalidCredentials:
        raise HTTPException(status_code=400, detail="wrong_password")
    except TooManyAttempts:
        raise HTTPException(status_code=429, detail="too_many")
    return {"message": "Password updated successfully"}


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    await auth_service.request_password_reset(db, data.username, data.email)
    # Same response whether the user exists or not — don't leak existence
    return {"message": "If this account exists, a reset email has been sent"}


@router.post("/verify-reset-code")
def verify_reset_code(data: VerifyResetCodeRequest, db: Session = Depends(get_db)):
    try:
        auth_service.verify_reset_code(db, data.email, data.token)
    except InvalidResetCode:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    except TooManyAttempts:
        raise HTTPException(status_code=429, detail="too_many")
    return {"message": "Code is valid"}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, background_tasks: BackgroundTasks,
                   db: Session = Depends(get_db)):
    try:
        auth_service.reset_password(db, data.email, data.token, data.new_password,
                                    schedule=background_tasks.add_task)
    except InvalidResetCode:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    except TooManyAttempts:
        raise HTTPException(status_code=429, detail="too_many")
    return {"message": "Password updated successfully"}
