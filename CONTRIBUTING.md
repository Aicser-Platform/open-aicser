# Contributing to Open Aicser

This document explains the repository structure, how CE and EE editions are connected,
how the codebase works at runtime, and how to contribute as a CE developer.

---

## Table of Contents

1. [Repository Overview](#1-repository-overview)
2. [How the Three Repos Connect](#2-how-the-three-repos-connect)
3. [The Fallback Pattern](#3-the-fallback-pattern)
4. [Runtime Behaviour: CE vs EE](#4-runtime-behaviour-ce-vs-ee)
5. [How EE Features Are Hidden from CE](#5-how-ee-features-are-hidden-from-ce)
6. [CI/CD Pipeline](#6-cicd-pipeline)
7. [Local Development (CE contributor)](#7-local-development-ce-contributor)
8. [Environment Variables](#8-environment-variables)
9. [Adding Features](#9-adding-features)
10. [EE Access and the 404 on Submodule Links](#10-ee-access-and-the-404-on-submodule-links)

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

import apiClient from "../../lib/axios"; // → src/lib/axios.ts
import { Button } from "../../components/ui/button"; // → src/components/ui/button.tsx
```

Two levels up (`../../`) = `sso/` → `ee/` → `src/`.

---

## 3. The Fallback Pattern

This is the key mechanism that allows the CE repo to build and run without
the EE submodule being present.

### Server fallback (`try/except ImportError`)

When the EE submodule is **absent**, `server/app/ee/` is an empty directory —
there is no `__init__.py`, so `import app.ee` raises `ImportError`.
`server/app/main.py` catches this safely:

```python
def include_ee_routers(app: FastAPI) -> None:
    if os.environ.get("EDITION", "CE") != "EE":
        return                            # CE: skip entirely
    try:
        from app.ee import SsoRouter, AuditLogRouter, LicensingRouter, RbacRouter, RbacMiddleware
    except ImportError:
        return                            # EE submodule not checked out
    for router in [SsoRouter, AuditLogRouter, LicensingRouter, RbacRouter]:
        if router is not None:
            app.include_router(router)
    if RbacMiddleware is not None:
        app.add_middleware(RbacMiddleware)
```

When the EE submodule **is present**, the import succeeds and all EE routers
and middleware are registered.

### Client fallback (`client/src/ee-fallback.ts`)

When the EE submodule is absent, `client/src/ee/` is an empty directory.
`next.config.mjs` detects this at build time and aliases `@/ee` to the
fallback file:

```js
// next.config.mjs
const eeIndex = path.resolve(__dirname, "src/ee/index.ts");
const eeFallback = path.resolve(__dirname, "src/ee-fallback.ts");
const eeEntry = existsSync(eeIndex) ? path.dirname(eeIndex) : eeFallback;
// webpack: config.resolve.alias['@/ee'] = eeEntry
```

`src/ee-fallback.ts` exports null stubs with the same names as the real EE
components so all imports resolve without errors:

```typescript
export const SsoSettings = () => null;
export const AuditLogPage = () => null;
export const RbacManager = () => null;
export const BillingPage = () => null;
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

| Route                         | CE              | EE                     |
| ----------------------------- | --------------- | ---------------------- |
| `POST /auth/login`            | ✓ returns JWT   | ✓ + writes audit event |
| `POST /auth/logout`           | ✓               | ✓ + writes audit event |
| `POST /users/`                | ✓ register      | ✓ register             |
| `GET /users/me`               | ✓               | ✓                      |
| `GET /audit-log/`             | — not available | ✓ admin-only           |
| `GET /licensing/status`       | — not available | ✓                      |
| `POST /licensing/activate`    | — not available | ✓ admin-only           |
| `GET /sso/providers`          | — not available | ✓                      |
| `POST /sso/providers`         | — not available | ✓ admin-only           |
| `GET /rbac/roles`             | — not available | ✓                      |
| `POST /rbac/users/{id}/roles` | — not available | ✓ admin-only           |

### Frontend pages

| Page         | CE                        | EE                                     |
| ------------ | ------------------------- | -------------------------------------- |
| `/` Home     | ✓                         | ✓                                      |
| `/login`     | ✓                         | ✓                                      |
| `/register`  | ✓                         | ✓                                      |
| `/dashboard` | ✓ profile                 | ✓ profile                              |
| `/settings`  | ✓ (SSO panel hidden)      | ✓ + SSO configuration panel            |
| `/audit-log` | redirects to `/dashboard` | ✓ `<AuditLogPage />` from EE submodule |
| `/rbac`      | redirects to `/dashboard` | ✓ `<RbacManager />` from EE submodule  |
| `/billing`   | redirects to `/dashboard` | ✓ `<BillingPage />` from EE submodule  |

### Navigation bar

Every authenticated page renders a `<Navbar>` component (via `NavbarWrapper` in
the root layout). The nav links shown depend on the edition:

**CE nav:** Dashboard · Settings  
**EE nav:** Dashboard · Audit Log · Roles & Permissions · Billing · Settings

The edition badge next to the app name changes colour — grey `CE` or purple `EE`.
The navbar is hidden on `/login` and `/register`.

Key files:

- `client/src/components/Navbar.tsx` — link lists, edition badge, logout button
- `client/src/components/NavbarWrapper.tsx` — reads the current pathname and
  suppresses the navbar on auth pages; imported by `app/layout.tsx`

### Middleware

In EE, `RbacMiddleware` is added to the FastAPI app. It intercepts every request,
reads the JWT, resolves the user's roles, and returns `403` if the user lacks the
required permission for that route. Admins bypass RBAC checks entirely.

---

## 5. How EE Features Are Hidden from CE

EE features are hidden at two independent layers — backend and frontend. Both
must be in place for a feature to be truly EE-only.

### Backend hiding

EE API routes live exclusively in `open-aicser-ee-server`. The CE server never
registers them because `main.py` short-circuits on edition and catches import
failures:

```python
def include_ee_routers(app: FastAPI) -> None:
    if os.environ.get("EDITION", "CE") != "EE":
        return                          # CE: exits before any EE import
    try:
        from app.ee import YourNewRouter
        app.include_router(YourNewRouter)
    except ImportError:
        return                          # EE submodule absent: safe no-op
```

A CE user hitting `/your-ee-route` receives **404** — the route does not exist
in the CE process. There is no authentication check involved; the path is simply
unregistered.

### Frontend hiding

Three mechanisms work together:

**1. Source code stays in the EE repo**

The component is implemented only in `open-aicser-ee-client`. In a CE build,
`@/ee` is aliased by webpack to `src/ee-fallback.ts`, which exports `() => null`
for every EE component name. The CE bundle contains no EE logic.

**2. Page-level redirect guard**

Every EE-only page in the CE repo starts with:

```typescript
const isEE = process.env.NEXT_PUBLIC_EDITION === 'EE';

export default function YourEEPage() {
  if (!isEE) redirect('/dashboard');   // CE users never see this page
  return <YourEEComponent />;
}
```

`NEXT_PUBLIC_EDITION` is baked in at build time (`CE` or `EE`), so in a CE
build the redirect is unconditional and the component import is tree-shaken away.

**3. Nav link only in EE**

The link to the page is added only to `EE_LINKS` in `Navbar.tsx`, so CE users
have no visible entry point to the page.

### What CE users see vs EE users

| Layer                      | CE                       | EE                  |
| -------------------------- | ------------------------ | ------------------- |
| API route                  | 404 (not registered)     | Real response       |
| Nav link                   | Not rendered             | Visible             |
| Page URL (direct access)   | Redirect to `/dashboard` | Renders component   |
| Component source in bundle | `() => null` stub        | Real implementation |

### EE components importing CE code

EE components can freely use CE utilities, the axios client, and CE UI components
via relative imports — they are mounted one level inside `src/`:

```typescript
// open-aicser-ee-client/your-feature/YourFeature.tsx
import apiClient from "../../lib/axios"; // CE axios instance
import { Button } from "../../components/ui/button"; // CE component
import { useAuthStore } from "../../store/auth.store"; // CE zustand store
```

EE repos **must not** create their own copies of `apiClient`, zustand stores, or
shared UI components. They inherit everything from CE via these relative paths.

---

## 6. CI/CD Pipeline

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

## 7. Local Development (CE contributor)

You do **not** need access to the EE repos to contribute to CE.

### Clone

```bash
git clone https://github.com/Aicser-Platform/open-aicser.git
cd open-aicser
```

Do not run `git submodule update`. When the EE submodule is absent, the server
uses `try/except ImportError` and the client falls back to `src/ee-fallback.ts`
— everything CE needs is already in place.

### Option A — Docker (recommended)

The fastest way to get everything running together. Requires Docker Desktop or
Docker Engine with the Compose plugin.

**CE:**

```bash
cd deploy
docker compose -f docker-compose.dev.yml up
```

**EE** (requires EE submodule checked out):

```bash
cd deploy
EDITION=EE docker compose -f docker-compose.dev.yml up
```

Services:
| Service | URL |
|---------|-----|
| Client (Next.js) | http://localhost:3000 |
| Server (FastAPI) | http://localhost:8000 |
| API docs | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |

The first run installs all dependencies into named Docker volumes — subsequent
runs start in seconds. Source code is mounted as a volume so changes hot-reload
without restarting containers.

**Useful commands:**

```bash
# Rebuild after changing requirements.txt or package.json
docker compose -f docker-compose.dev.yml up --build

# Run in background
docker compose -f docker-compose.dev.yml up -d

# View logs
docker compose -f docker-compose.dev.yml logs -f server
docker compose -f docker-compose.dev.yml logs -f client

# Stop everything
docker compose -f docker-compose.dev.yml down

# Stop and delete volumes (resets deps cache and database)
docker compose -f docker-compose.dev.yml down -v
```

### Option B — Run services manually (no Docker)

Use this if you prefer running processes directly on your machine.

**Backend** (requires Python 3.12+):

```bash
cd server

# Copy env and fill in SECRET_KEY
cp .env.example .env

pip install -r requirements.txt
uvicorn app.main:app --reload
```

Server starts at `http://localhost:8000`. SQLite is used by default — no
database setup required.

**Frontend** (requires Node.js 20+):

```bash
cd client

cp .env.example .env.local   # defaults work for local dev

npm install
npm run dev
```

Client starts at `http://localhost:3000`.

### Verifying CE works

1. Open `http://localhost:3000/register` — create an account
2. Open `http://localhost:3000/login` — sign in
3. You should land on `/dashboard` showing your profile
4. The `EDITION` badge shows `CE`
5. No SSO / Audit Log / RBAC panels are visible — this is correct

### EE development workflow

When implementing or editing EE features, **edit directly inside the submodule
paths** (`server/app/ee/` and `client/src/ee/`). These directories are git repos
checked out inside the CE repo — committing from them pushes directly to the
private EE repos on GitHub.

```bash
# 1. Checkout EE submodules (one-time, requires EE access)
git submodule update --init --recursive

# 2. Edit files in the submodule path
vim client/src/ee/audit-log/AuditLogPage.tsx

# 3. Commit and push from inside the submodule
cd client/src/ee
git add audit-log/AuditLogPage.tsx
git commit -m "feat: improve audit log filtering"
git push                          # → pushes to open-aicser-ee-client on GitHub

# 4. Update the submodule pointer in the CE repo
cd ../../..                       # back to open-aicser root
git add client/src/ee
git commit -m "chore: bump EE client submodule"
git push
```

You do **not** need to separately edit the standalone `open-aicser-ee-client/`
or `open-aicser-ee-server/` directories — they are just other local checkouts of
the same remote repos. Always commit from the submodule path so the CE repo's
pointer stays in sync.

---

## 8. Environment Variables

### `server/.env`

| Variable                      | Required | Default                      | Description                                                                                  |
| ----------------------------- | -------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| `EDITION`                     | no       | `CE`                         | Set to `EE` to activate EE features                                                          |
| `DATABASE_URL`                | no       | `sqlite:///./open_aicser.db` | Any SQLAlchemy-compatible URL                                                                |
| `SECRET_KEY`                  | **yes**  | —                            | JWT signing secret. Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no       | `60`                         | JWT lifetime                                                                                 |

### `client/.env.local`

| Variable              | Required | Default                 | Description                        |
| --------------------- | -------- | ----------------------- | ---------------------------------- |
| `NEXT_PUBLIC_EDITION` | no       | `CE`                    | Controls which EE UI panels render |
| `NEXT_PUBLIC_API_URL` | no       | `http://localhost:8000` | Backend API base URL               |

### Root `.env` (CI / submodule access)

| Variable             | Where used            | Description                           |
| -------------------- | --------------------- | ------------------------------------- |
| `EE_SUBMODULE_TOKEN` | GitHub Actions secret | PAT with read access to both EE repos |

---

## 9. Adding Features

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

### Example: adding a new CE frontend page

Create `client/src/app/widgets/page.tsx`. If the page requires authentication,
redirect to `/login` when no token is found (see `dashboard/page.tsx` for the
pattern).

The `<Navbar>` renders automatically on every page (except `/login` and
`/register`) via `NavbarWrapper` in the root layout — no extra wiring needed.

### Example: adding a new EE-only frontend page

There are three steps:

**1. Add a service + component to the EE client submodule** (`open-aicser-ee-client`):

Follow the same service layer pattern as CE — keep API calls in a service file,
keep the component focused on rendering. The service imports `apiClient` from the
CE repo via relative path. Do **not** create a new axios instance or zustand store.

```typescript
// open-aicser-ee-client/widgets/widgets.service.ts
import apiClient from "../../lib/axios"; // CE axios — do not duplicate

export const widgetsService = {
  list: () => apiClient.get("/widgets/").then((r) => r.data),
  create: (data: unknown) =>
    apiClient.post("/widgets/", data).then((r) => r.data),
};
```

Then implement the component:

```typescript
// open-aicser-ee-client/widgets/WidgetsPage.tsx
export function WidgetsPage() {
  return <div>Widgets — EE feature</div>;
}
```

Export it from the submodule's index:

```typescript
// open-aicser-ee-client/index.ts
export { WidgetsPage } from "./widgets/WidgetsPage";
```

**2. Add a null stub to `client/src/ee-fallback.ts`** (CE repo):

```typescript
export const WidgetsPage = () => null;
```

**3. Create the page in the CE repo** and add it to the nav:

```typescript
// client/src/app/widgets/page.tsx
'use client';

import { redirect } from 'next/navigation';
import { WidgetsPage } from '@/ee';

const isEE = process.env.NEXT_PUBLIC_EDITION === 'EE';

export default function WidgetsRoute() {
  if (!isEE) redirect('/dashboard');
  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Widgets</h1>
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <WidgetsPage />
        </div>
      </div>
    </div>
  );
}
```

Then add the link to the `EE_LINKS` array in `client/src/components/Navbar.tsx`:

```typescript
const EE_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/audit-log", label: "Audit Log" },
  { href: "/rbac", label: "Roles & Permissions" },
  { href: "/billing", label: "Billing" },
  { href: "/widgets", label: "Widgets" }, // ← new
  { href: "/settings", label: "Settings" },
];
```

The `if (!isEE) redirect('/dashboard')` guard ensures CE users who navigate
directly to `/widgets` are sent back to the dashboard.

### Rules for CE code

- **Never import from `app.ee.*`** directly in CE modules. Use the `_audit()`
  pattern (a runtime `EDITION` check with the import inside the function body)
  if a CE module needs to optionally call an EE service.
- **Never import from `@/ee`** in a way that would fail when the submodule is
  absent. `ee-fallback.ts` exports all the same names as the real EE package,
  so standard imports are safe as long as you guard rendering with `isEE`.
- Keep CE features self-contained. EE features extend CE, not the other way around.

---

## 10. EE Access and the 404 on Submodule Links

On GitHub, the `server/app/ee` and `client/src/ee` folders appear as linked
submodule entries. Clicking them navigates to the private EE repo URL.

If you do not have access to the EE repos, GitHub shows a **404 "Repository not
found"** page. This is intentional — the EE code is proprietary and access-controlled.

It does **not** affect your ability to work with CE. The CE fallback stubs ensure
everything compiles and runs without the EE repos being present.

To request EE access, contact the platform team.
