import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.refresh_token import RefreshToken
from app.schemas.auth import (
    LoginRequest, TokenResponse, RefreshRequest,
    ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest,
)
from app.core.security import (
    verify_password, create_access_token, create_refresh_token, hash_password,
)
from app.core.email import send_reset_password_email
from app.dependencies import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "is_admin": user.is_admin}
    )
    refresh_token_value, expires_at = create_refresh_token()

    db.add(RefreshToken(token=refresh_token_value, user_id=user.id, expires_at=expires_at))
    db.commit()

    return {"access_token": access_token, "refresh_token": refresh_token_value, "token_type": "bearer"}


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    entry = db.query(RefreshToken).filter(RefreshToken.token == data.refresh_token).first()

    if not entry or entry.revoked or entry.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user = db.query(User).filter(User.id == entry.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Rotate: revoke old token, issue new one
    entry.revoked = True
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "is_admin": user.is_admin}
    )
    new_refresh_token, new_expires_at = create_refresh_token()
    db.add(RefreshToken(token=new_refresh_token, user_id=user.id, expires_at=new_expires_at))
    db.commit()

    return {"access_token": access_token, "refresh_token": new_refresh_token, "token_type": "bearer"}


@router.post("/logout")
def logout(data: RefreshRequest, db: Session = Depends(get_db)):
    entry = db.query(RefreshToken).filter(RefreshToken.token == data.refresh_token).first()
    if entry:
        entry.revoked = True
        db.commit()
    return {"message": "Logged out"}


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.username == data.username,
        User.email == data.email,
    ).first()

    response = {"message": "If this account exists, a reset email has been sent"}
    if not user:
        return response

    code = str(random.randint(100000, 999999))
    user.reset_code = code
    user.reset_code_expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.commit()

    await send_reset_password_email(data.email, code)
    return response


@router.post("/verify-reset-code")
def verify_reset_code(data: VerifyResetCodeRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if (
        not user
        or user.reset_code != data.token
        or not user.reset_code_expires
        or user.reset_code_expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    return {"message": "Code is valid"}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if (
        not user
        or user.reset_code != data.token
        or not user.reset_code_expires
        or user.reset_code_expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user.hashed_password = hash_password(data.new_password)
    user.reset_code = None
    user.reset_code_expires = None
    db.commit()
    return {"message": "Password updated successfully"}
