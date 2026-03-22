import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, ForgotPasswordRequest, VerifyResetCodeRequest, ResetPasswordRequest
from app.core.security import verify_password, create_access_token, hash_password
from app.core.email import send_reset_password_email
from app.dependencies import get_db

router = APIRouter(prefix="/auth", tags=["Auth"])

# In-memory reset token store: email -> { token, user_id, expires }
_reset_tokens: dict = {}

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "is_admin": user.is_admin
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.username == data.username,
        User.email == data.email
    ).first()

    # Always return the same message to avoid user enumeration
    response = {"message": "If this account exists, a reset email has been sent"}

    if not user:
        return response

    token = str(random.randint(100000, 999999))
    _reset_tokens[data.email] = {
        "token": token,
        "user_id": user.id,
        "expires": datetime.now(timezone.utc) + timedelta(minutes=15),
    }

    await send_reset_password_email(data.email, token)
    return response


@router.post("/verify-reset-code")
def verify_reset_code(data: VerifyResetCodeRequest):
    entry = _reset_tokens.get(data.email)
    if not entry or entry["token"] != data.token or datetime.now(timezone.utc) > entry["expires"]:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    return {"message": "Code is valid"}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    entry = _reset_tokens.get(data.email)

    if not entry or entry["token"] != data.token:
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    if datetime.now(timezone.utc) > entry["expires"]:
        del _reset_tokens[data.email]
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user = db.query(User).filter(User.id == entry["user_id"]).first()
    user.hashed_password = hash_password(data.new_password)
    db.commit()

    del _reset_tokens[data.email]
    return {"message": "Password updated successfully"}