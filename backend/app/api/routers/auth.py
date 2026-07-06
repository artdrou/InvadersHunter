from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.auth import (
    LoginRequest, TokenResponse, RefreshRequest,
    ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest,
)
from app.dependencies import get_db
from app.services import auth_service
from app.services.auth_service import (
    InvalidCredentials, InvalidRefreshToken, InvalidResetCode,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    try:
        return auth_service.login(db, data.username, data.password)
    except InvalidCredentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")


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
    return {"message": "Code is valid"}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        auth_service.reset_password(db, data.email, data.token, data.new_password)
    except InvalidResetCode:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    return {"message": "Password updated successfully"}
