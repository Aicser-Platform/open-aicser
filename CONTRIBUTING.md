# Contributing to Open Aicser

This document explains the repository structure, how CE and EE editions are connected,
how the codebase works at runtime, and how to contribute as a CE developer.

---

## Table of Contents

1. [Repository Overview](#1-repository-overview)
2. [How the Three Repos Connect](#2-how-the-three-repos-connect)
3. [The Fallback Pattern](#3-the-fallback-pattern)
4. [Runtime Behaviour: CE vs EE](#4-runtime-behaviour-ce-vs-ee)
5. [CI/CD Pipeline](#5-cicd-pipeline)
6. [Local Development (CE contributor)](#6-local-development-ce-contributor)
7. [Environment Variables](#7-environment-variables)
8. [Adding a New CE Feature](#8-adding-a-new-ce-feature)
9. [EE Access and the 404 on Submodule Links](#9-ee-access-and-the-404-on-submodule-links)

---

## 1. Repository Overview

The project is split across three Git repositories:

```
open-aicser                   ← CE repo (this repo, public)
├── server/                   ← FastAPI backend (Python)
│   └── app/
│       ├── modules/          ← CE feature modules (auth, users, apps)
│       └── ee/               ← submodule mount point  ─┐
│                                                        │ git submodule
open-aicser-ee-server         ← EE server repo (private) ┘
├── audit_log/
├── licensing/
├── rbac/
└── sso/

open-aicser                   (same CE repo, continued)
└── client/                   ← Next.js frontend (TypeScript)
    └── src/
        ├── app/              ← pages (login, dashboard, settings…)
        ├── components/       ← shared UI components
        ├── lib/              ← api client, auth helpers
        └── ee/               ← submodule mount point  ─┐
                                                         │ git submodule
open-aicser-ee-client         ← EE client repo (private) ┘
├── audit-log/
├── billing/
├── rbac/
└── sso/
```

**CE (Community Edition)** — this public repo. Contains all core features.
Anyone can clone, run, and contribute to it.

**EE (Enterprise Edition)** — two private repos mounted as git submodules inside
the CE repo at `server/app/ee/` and `client/src/ee/`. Contains paid features
(SSO, Audit Log, RBAC, Billing/Licensing). Access is restricted to EE customers
and internal team members.

---

## 2. How the Three Repos Connect

### Git submodules

The `.gitmodules` file at the root of `open-aicser` declares the two EE repos
as submodules:

```ini
[submodule "server/app/ee"]
    path = server/app/ee
    url  = https://github.com/Aicser-Platform/open-aicser-ee-server.git

[submodule "client/src/ee"]
    path = client/src/ee
    url  = https://github.com/Aicser-Platform/open-aicser-ee-client.git
```

The CE repo does **not** store the EE source code. It only stores a pointer
(a commit SHA) to a specific version of each EE repo. When the EE submodule is
checked out, its files appear at those paths as if they were part of the CE repo.

```
open-aicser (CE repo)
    └── server/app/ee/          ← when submodule is present
            __init__.py         ← from open-aicser-ee-server
            audit_log/
            licensing/
            rbac/
            sso/

    └── server/app/ee/          ← when submodule is absent (CE-only checkout)
            __init__.py         ← CE fallback stub (all values = None)
```

### How the EE server modules import CE code

The EE server modules are mounted at `server/app/ee/`, which makes them part of
the `app.ee` Python package. They use relative imports to reach shared CE code:

```python
# Inside open-aicser-ee-server/audit_log/router.py
# Mounted at: server/app/ee/audit_log/router.py → app.ee.audit_log.router

from ...db import get_db                        # → app.db
from ...modules.auth.deps import get_current_user  # → app.modules.auth.deps
from ...modules.users.model import User         # → app.modules.users.model
```

Three dots (`...`) = go up three package levels: `audit_log` → `ee` → `app`.

### How the EE client modules import CE code

The EE client is mounted at `client/src/ee/`, one level below `src/`. Components
use relative paths to reach shared CE code:

```typescript
// Inside open-aicser-ee-client/sso/SsoSettings.tsx
// Mounted at: client/src/ee/sso/SsoSettings.tsx

import { apiFetch } from '../../lib/api';        // → src/lib/api.ts
import { Button } from '../../components/ui/button'; // → src/components/ui/button.tsx
```

Two levels up (`../../`) = `sso/` → `ee/` → `src/`.

---

## 3. The Fallback Pattern

This is the key mechanism that allows the CE repo to build and run without
the EE submodule being present.

### Server fallback (`server/app/ee/__init__.py`)

When the EE submodule is **absent**, the CE repo contains its own stub at
`server/app/ee/__init__.py`:

```python
# CE fallback — EE submodule replaces this with real modules
SsoRouter     = None
AuditLogRouter = None
LicensingRouter = None
RbacRouter    = None
RbacMiddleware = None
```

When the EE submodule **is present**, the submodule's own `__init__.py` replaces
this file, exporting real router and middleware objects.

`server/app/main.py` handles both cases safely:

```python
def include_ee_routers(app: FastAPI) -> None:
    if os.environ.get("EDITION", "CE") != "EE":
        return                            # CE: skip entirely
    from app.ee import SsoRouter, AuditLogRouter, LicensingRouter, RbacRouter, RbacMiddleware
    for router in [SsoRouter, AuditLogRouter, LicensingRouter, RbacRouter]:
        if router is not None:            # guards against the CE stub
            app.include_router(router)
    if RbacMiddleware is not None:
        app.add_middleware(RbacMiddleware)
```

### Client fallback (`client/src/ee/index.ts`)

The same pattern applies on the frontend. When the EE submodule is absent,
the CE repo provides:

```typescript
// CE fallback — EE submodule replaces this with real components
export const SsoSettings  = () => null;
export const AuditLogPage = () => null;
export const RbacManager  = () => null;
export const BillingPage  = () => null;
```

CE pages import from `@/ee` normally. The component just renders nothing in CE:

```typescript
// client/src/app/settings/page.tsx
import { SsoSettings } from '@/ee';

const isEE = process.env.NEXT_PUBLIC_EDITION === 'EE';

export default function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      {isEE && <SsoSettings />}   {/* null in CE, real UI in EE */}
    </div>
  );
}
```

### Audit log hook in CE auth

Some CE code conditionally calls EE services using a runtime check:

```python
# server/app/modules/auth/router.py
def _audit(db, action, *, user=None, request=None):
    if os.environ.get("EDITION", "CE") != "EE":
        return                          # no-op in CE
    from app.ee.audit_log.service import log_event
    log_event(db, action, ...)         # only runs in EE
```

The import is inside the function body so it is never evaluated in CE, even
if the EE submodule is absent.

---

## 4. Runtime Behaviour: CE vs EE

### API routes

| Route | CE | EE |
|-------|----|----|
| `POST /auth/login` | ✓ returns JWT | ✓ + writes audit event |
| `POST /auth/logout` | ✓ | ✓ + writes audit event |
| `POST /users/` | ✓ register | ✓ register |
| `GET /users/me` | ✓ | ✓ |
| `GET /audit-log/` | — not available | ✓ admin-only |
| `GET /licensing/status` | — not available | ✓ |
| `POST /licensing/activate` | — not available | ✓ admin-only |
| `GET /sso/providers` | — not available | ✓ |
| `POST /sso/providers` | — not available | ✓ admin-only |
| `GET /rbac/roles` | — not available | ✓ |
| `POST /rbac/users/{id}/roles` | — not available | ✓ admin-only |

### Frontend pages

| Page | CE | EE |
|------|----|----|
| `/` Home | ✓ | ✓ |
| `/login` | ✓ | ✓ |
| `/register` | ✓ | ✓ |
| `/dashboard` | ✓ profile only | ✓ profile + SSO settings + Audit log |
| `/settings` | ✓ (SSO panel hidden) | ✓ SSO configuration panel |

### Middleware

In EE, `RbacMiddleware` is added to the FastAPI app. It intercepts every request,
reads the JWT, resolves the user's roles, and returns `403` if the user lacks the
required permission for that route. Admins bypass RBAC checks entirely.

---

## 5. CI/CD Pipeline

Two GitHub Actions workflows run on every push/PR to `main`.

### `build.yml` — builds and pushes Docker images

```
push or PR to main
        │
        ├─── build-ce job ──────────────────────────────────────────────
        │     actions/checkout (no submodules)
        │     docker build --build-arg EDITION=CE ./server  → server:ce-<sha>
        │     docker build --build-arg EDITION=CE ./client  → client:ce-<sha>
        │     docker push (on push to main only)
        │
        └─── build-ee job ──────────────────────────────────────────────
              actions/checkout --recurse-submodules
                  token: secrets.EE_SUBMODULE_TOKEN  (PAT with EE repo access)
              docker build --build-arg EDITION=EE ./server  → server:ee-<sha>
              docker build --build-arg EDITION=EE ./client  → client:ee-<sha>
              docker push (on push to main only)
```

The CE job never touches the EE repos. If `EE_SUBMODULE_TOKEN` is not set, only
the CE build runs successfully — this is the expected behaviour for external PRs.

### `bump-ee-submodules.yml` — keeps EE pointers up to date

When a commit lands in `open-aicser-ee-server` or `open-aicser-ee-client`, those
repos fire a `repository_dispatch` event to this repo:

```bash
curl -X POST \
  -H "Authorization: Bearer $CE_DISPATCH_TOKEN" \
  https://api.github.com/repos/Aicser-Platform/open-aicser/dispatches \
  -d '{"event_type": "ee-server-updated"}'
```

The workflow then runs:

```
repository_dispatch (ee-server-updated or ee-client-updated)
        │
        └─── bump job
              checkout with submodules
              git submodule update --remote server/app/ee
              git submodule update --remote client/src/ee
              git commit "chore: bump EE submodules [skip ci]"
              git push
```

This means the CE repo always tracks the latest `main` of each EE repo
automatically. No manual pointer updates needed.

---

## 6. Local Development (CE contributor)

You do **not** need access to the EE repos to contribute to CE.

### Clone

```bash
git clone https://github.com/Aicser-Platform/open-aicser.git
cd open-aicser
```

Do not run `git submodule update`. The CE fallback stubs at
`server/app/ee/__init__.py` and `client/src/ee/index.ts` already provide
everything CE needs.

### Backend setup

```bash
cd server

# Copy env file and fill in SECRET_KEY
cp .env.example .env

# Install dependencies (requires Python 3.12+)
pip install -r requirements.txt

# Run the dev server
uvicorn app.main:app --reload
```

The server starts at `http://localhost:8000`.
Interactive API docs are at `http://localhost:8000/docs`.

SQLite is used by default — no database setup required.

### Frontend setup

```bash
cd client

# Copy env file (defaults work for local dev)
cp .env.example .env.local

# Install dependencies
npm install

# Run the dev server
npm run dev
```

The client starts at `http://localhost:3000`.

### Docker (both services together)

```bash
cd deploy
docker compose -f docker-compose.ce.yml up --build
```

This starts:
- PostgreSQL on port `5432`
- FastAPI server on port `8000`
- Next.js client on port `3000`

### Verifying CE works

1. Open `http://localhost:3000/register` — create an account
2. Open `http://localhost:3000/login` — sign in
3. You should land on `/dashboard` showing your profile
4. The `EDITION` badge shows `CE`
5. No SSO / Audit Log / RBAC panels are visible — this is correct

---

## 7. Environment Variables

### `server/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EDITION` | no | `CE` | Set to `EE` to activate EE features |
| `DATABASE_URL` | no | `sqlite:///./open_aicser.db` | Any SQLAlchemy-compatible URL |
| `SECRET_KEY` | **yes** | — | JWT signing secret. Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | `60` | JWT lifetime |

### `client/.env.local`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_EDITION` | no | `CE` | Controls which EE UI panels render |
| `NEXT_PUBLIC_API_URL` | no | `http://localhost:8000` | Backend API base URL |

### Root `.env` (CI / submodule access)

| Variable | Where used | Description |
|----------|------------|-------------|
| `EE_SUBMODULE_TOKEN` | GitHub Actions secret | PAT with read access to both EE repos |

---

## 8. Adding a New CE Feature

CE features live in `server/app/modules/` (backend) and `client/src/` (frontend).
They are available in both CE and EE builds.

### Example: adding a new backend module

```
server/app/modules/
└── widgets/                ← new module
    ├── __init__.py
    ├── model.py            ← SQLAlchemy model
    ├── schemas.py          ← Pydantic schemas
    ├── service.py          ← business logic
    └── router.py           ← FastAPI router
```

Register the model and router in `server/app/main.py`:

```python
import app.modules.widgets.model                         # registers with Base
from app.modules.widgets.router import router as widgets_router

app.include_router(widgets_router, prefix="/widgets", tags=["widgets"])
```

### Example: adding a new frontend page

Create `client/src/app/widgets/page.tsx`. If the page requires authentication,
redirect to `/login` when no token is found (see `dashboard/page.tsx` for the
pattern).

### Rules for CE code

- **Never import from `app.ee.*`** directly in CE modules. Use the `_audit()`
  pattern (a runtime `EDITION` check with the import inside the function body)
  if a CE module needs to optionally call an EE service.
- **Never import from `@/ee`** in a way that would fail when the submodule is
  absent. The CE `ee/index.ts` fallback exports all the same names, so standard
  imports are safe as long as you guard rendering with `isEE`.
- Keep CE features self-contained. EE features extend CE, not the other way around.

---

## 9. EE Access and the 404 on Submodule Links

On GitHub, the `server/app/ee` and `client/src/ee` folders appear as linked
submodule entries. Clicking them navigates to the private EE repo URL.

If you do not have access to the EE repos, GitHub shows a **404 "Repository not
found"** page. This is intentional — the EE code is proprietary and access-controlled.

It does **not** affect your ability to work with CE. The CE fallback stubs ensure
everything compiles and runs without the EE repos being present.

To request EE access, contact the platform team.
