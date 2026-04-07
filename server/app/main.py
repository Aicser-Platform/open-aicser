import os
from fastapi import FastAPI
from app.modules.auth.router import router as auth_router
from app.modules.users.router import router as users_router
from app.modules.apps.router import router as apps_router

app = FastAPI(title="Open Aicser")


def is_ee() -> bool:
    return os.environ.get("EDITION", "CE") == "EE"


def include_ee_routers(app: FastAPI) -> None:
    if not is_ee():
        return
    from app.ee import SsoRouter, AuditLogRouter, LicensingRouter
    for router in [SsoRouter, AuditLogRouter, LicensingRouter]:
        if router is not None:
            app.include_router(router)


app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(users_router, prefix="/users", tags=["users"])
app.include_router(apps_router, prefix="/apps", tags=["apps"])

include_ee_routers(app)
