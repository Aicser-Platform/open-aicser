import os
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.modules.users.service import get_user_by_email, verify_password
from .jwt import create_access_token
from .schemas import LoginRequest, TokenResponse
from .deps import get_current_user

router = APIRouter()


def _audit(db: Session, action: str, *, user=None, request: Request | None = None):
    """Write an audit event when running in EE mode; no-op in CE."""
    if os.environ.get("EDITION", "CE") != "EE":
        return
    try:
        from app.ee.audit_log.service import log_event
        log_event(
            db,
            action,
            actor_id=user.id if user else None,
            actor_email=user.email if user else None,
            resource=f"user:{user.id}" if user else None,
            ip_address=request.client.host if request and request.client else None,
        )
    except Exception:
        pass  # never let audit errors break auth


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = get_user_by_email(db, data.email)
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    token = create_access_token(user.id)
    _audit(db, "user.login", user=user, request=request)
    return TokenResponse(access_token=token)


@router.post("/logout")
def logout(request: Request, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    _audit(db, "user.logout", user=current_user, request=request)
    return {"detail": "Logged out"}
