from __future__ import annotations

from datetime import timedelta

import pyotp
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.auth.deps import get_current_user
from app.auth.security import create_access_token, get_password_hash, verify_password
from app.core.config import get_settings
from app.core.database import get_session
from app.models.user import User
from app.schemas.users import Token, TwoFASetup, TwoFAVerify, UserCreate, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/register", response_model=UserRead)
def register(user_in: UserCreate, session: Session = Depends(get_session)) -> User:
    if not settings.allow_user_registration:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Registration disabled")
    existing = session.exec(select(User).where(User.username == user_in.username)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
    user = User(username=user_in.username, hashed_password=get_password_hash(user_in.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)) -> Token:
    user = session.exec(select(User).where(User.username == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    if user.totp_secret:
        if not form_data.scopes:
            raise HTTPException(status_code=status.HTTP_412_PRECONDITION_FAILED, detail="2FA code required")
        code = form_data.scopes[0]
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(code, valid_window=1):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid 2FA code")
    access_token = create_access_token(user.username, timedelta(minutes=settings.access_token_expire_minutes))
    return Token(access_token=access_token)


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/2fa/setup", response_model=TwoFASetup)
def setup_twofa(current_user: User = Depends(get_current_user), session: Session = Depends(get_session)) -> TwoFASetup:
    secret = pyotp.random_base32()
    current_user.totp_secret = secret
    session.add(current_user)
    session.commit()
    otpauth_url = pyotp.totp.TOTP(secret).provisioning_uri(name=current_user.username, issuer_name=settings.app_name)
    return TwoFASetup(secret=secret, otpauth_url=otpauth_url)


@router.post("/2fa/verify")
def verify_twofa(payload: TwoFAVerify, current_user: User = Depends(get_current_user)) -> dict[str, bool]:
    if not current_user.totp_secret:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="2FA not enabled")
    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(payload.code, valid_window=1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid 2FA code")
    return {"valid": True}
