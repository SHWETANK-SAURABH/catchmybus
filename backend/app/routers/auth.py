"""Authentication service: register, login, current user (FR01, FR02, FR28)."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import User
from ..ratelimit import RateLimiter
from ..schemas import DemoLoginIn, LoginIn, RegisterIn, TokenOut, UserOut
from ..security import create_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
login_limiter = RateLimiter(get_settings().login_rate_limit_per_min, 60)


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    # Public registration always creates commuters; admins are seeded or created by an admin.
    user = User(name=body.name, email=email, phone=body.phone,
                password_hash=hash_password(body.password), role="COMMUTER")
    db.add(user)
    db.commit()
    return TokenOut(access_token=create_token(user), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    if not login_limiter.allow(ip):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many login attempts, try again in a minute")
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return TokenOut(access_token=create_token(user), user=UserOut.model_validate(user))


@router.get("/demo")
def demo_status():
    """Tells the login page whether to show the one-click demo buttons."""
    return {"enabled": get_settings().demo_login_enabled}


@router.post("/demo-login", response_model=TokenOut)
def demo_login(body: DemoLoginIn, request: Request, db: Session = Depends(get_db)):
    """Sign in as a seeded demo account without typing a password.

    Only works when DEMO_LOGIN_ENABLED=true, and only for the two seeded accounts, so
    the frontend never needs to contain a password. Shares the login rate limit.
    """
    s = get_settings()
    if not s.demo_login_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demo login is disabled")
    ip = request.client.host if request.client else "unknown"
    if not login_limiter.allow(ip):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many login attempts, try again in a minute")
    email = s.seed_admin_email if body.role == "ADMIN" else s.seed_commuter_email
    user = db.scalar(select(User).where(User.email == email.lower(), User.role == body.role))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demo account not found - run `make seed`")
    return TokenOut(access_token=create_token(user), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
