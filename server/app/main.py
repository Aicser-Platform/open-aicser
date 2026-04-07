import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db import engine, Base
from app.modules.auth.router import router as auth_router
from app.modules.users.router import router as users_router
from app.modules.apps.router import router as apps_router
import app.modules.users.model  # noqa: F401 — registers User with Base

app = FastAPI(title="Open Aicser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def create_tables():
    Base.metadata.create_all(bind=engine)


def is_ee() -> bool:
    return os.environ.get("EDITION", "CE") == "EE"


def include_ee_routers(app: FastAPI) -> None:
    if not is_ee():
        return
    try:
        from app.ee import SsoRouter, AuditLogRouter, LicensingRouter, RbacRouter, RbacMiddleware
    except ImportError:
        # EE submodule not checked out — safe to ignore in CE builds
        return
    for router in [SsoRouter, AuditLogRouter, LicensingRouter, RbacRouter]:
        if router is not None:
            app.include_router(router)
    if RbacMiddleware is not None:
        app.add_middleware(RbacMiddleware)


app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(apps_router, prefix="/apps", tags=["apps"])

include_ee_routers(app)
