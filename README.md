# Stokvel Management System

[![Codecov](https://img.shields.io/codecov/c/github/REPLACE_WITH_ORG/Stokvel-SD?label=coverage)](https://codecov.io/gh/REPLACE_WITH_ORG/Stokvel-SD)
[![Node.js](https://img.shields.io/badge/node-20%20LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](backend/package.json)

A full-stack platform for managing **stokvels**—South African community-based saving and investment clubs where members contribute regularly and receive scheduled payouts. This app helps treasurers and members run groups with structured meetings, contribution tracking, payout planning, invitations, and platform admin oversight.

**Core capabilities**

- Group (stokvel) creation, membership, and role-based access (member, treasurer, admin)
- Meeting scheduling and management
- Payments: contributions, cycles, payout roster, compliance reporting, and Quick Pay (Paystack)
- Email invitations and onboarding
- Platform admin tools for reviewing and managing groups
- Market rate widgets (SARB repo rate via FRED, when configured)

---

## Tech stack

| Layer       | Technology                                     |
| ----------- | ---------------------------------------------- |
| Frontend    | React 19, Vite 6, Tailwind CSS 4, React Router |
| Backend     | Node.js, Express 5                             |
| Data & auth | Supabase (Postgres, Auth, Storage)             |
| Payments    | Paystack (optional)                            |
| Email       | Nodemailer (optional)                          |

**How they connect**

- The browser talks to **Supabase Auth** directly for sign-in/session.
- The React app calls **`/api/*`** on the Express backend (proxied to port **5000** in local dev).
- The API uses Supabase (anon key with user JWT, or service role for admin/server jobs) for data and storage.

```
frontend (5173)  --/api/*-->  backend (5000)  -->  Supabase
       |                                              ^
       +------------ Supabase Auth (client) ----------+
```

---

## Repository layout

```
backend/                 Express API
frontend/                Vite + React SPA
supabase/migrations/     SQL migrations (apply to your Supabase project)
.github/workflows/       Codecov (tests) and Render deploy (backend)
```

---

## Prerequisites

- **Node.js 20 LTS** (matches CI; 20+ recommended)
- **npm** (bundled with Node)
- **Git**
- A **[Supabase](https://supabase.com)** project (free tier is fine for development)
- Optional: [Supabase CLI](https://supabase.com/docs/guides/cli) for `db push`
- Optional: [Paystack](https://paystack.com/) and [FRED](https://fred.stlouisfed.org/docs/api/api_key.html) keys for payments and market rates

---

## Database & Supabase Setup

This project uses Supabase for its PostgreSQL database and authentication. To run this locally, you must replicate the database schema.

1. **Create a project:** Go to the [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. **Apply the schema:**
   - Navigate to the **SQL Editor** in your Supabase dashboard.
   - Click **New Query**.
   - Open the `supabase/schema.sql` file from this repository, copy its entire contents, and paste it into the query editor.
   - Click **Run**. This will instantly create all necessary tables and security policies.
3. **Configure API Keys:** From **Project Settings → API**, copy your Project URL and `anon` key into both your backend and frontend `.env` files.

> **Note:** There is no bundled seed data. You can create test users via the app's sign-up flow. The provided SQL script automatically applies the necessary Row-Level Security (RLS) policies.

---

## Environment variables

Copy examples before first run:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

On Windows (Command Prompt): `copy backend\.env.example backend\.env` and `copy frontend\.env.example frontend\.env`.

### Backend (`backend/.env`)

| Variable                            | Required | Purpose                                                   | If missing                                                |
| ----------------------------------- | -------- | --------------------------------------------------------- | --------------------------------------------------------- |
| `SUPABASE_URL`                      | Yes      | Supabase project URL                                      | API fails to start / DB errors                            |
| `SUPABASE_ANON_KEY`                 | Yes      | Validates user JWTs on API routes                         | Auth-backed routes fail                                   |
| `SUPABASE_SERVICE_ROLE_KEY`         | Yes\*    | Admin routes, market sync, service queries                | Admin & server jobs fail                                  |
| `PORT`                              | No       | API port (default **5000**)                               | Uses 5000                                                 |
| `FRONTEND_URL`                      | No       | CORS / invitation links (default `http://localhost:5173`) | CORS may block browser; invite links default to localhost |
| `SUPABASE_DOCUMENTS_BUCKET`         | No       | Storage bucket name (default `stokvel-documents`)         | Uploads fail if bucket missing                            |
| `EMAIL_USER` / `EMAIL_APP_PASSWORD` | No       | SMTP for invitation emails                                | Invites created but email not sent                        |
| `FRED_API_KEY`                      | No       | SARB repo rate sync                                       | Market rate cron/job no-ops                               |
| `FRED_SA_POLICY_RATE_SERIES_ID`     | No       | FRED series override                                      | Uses default SA policy series                             |
| `PAYSTACK_SECRET_KEY`               | No       | Server-side Paystack verification                         | Quick Pay / verify flows fail                             |

\*Required for full functionality; basic authenticated routes may work with only anon key in some cases.

### Frontend (`frontend/.env`)

| Variable                   | Required | Purpose                         | If missing                                                   |
| -------------------------- | -------- | ------------------------------- | ------------------------------------------------------------ |
| `VITE_SUPABASE_URL`        | Yes      | Supabase project URL            | Auth and client DB access broken                             |
| `VITE_SUPABASE_ANON_KEY`   | Yes      | Supabase anon / publishable key | Same                                                         |
| `VITE_API_BASE_URL`        | No       | API origin in production        | Local dev uses Vite proxy; production needs your backend URL |
| `VITE_PAYSTACK_PUBLIC_KEY` | No       | Paystack checkout in browser    | Quick Pay disabled / errors                                  |

`VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` is also accepted as an alias for the anon key.

---

## Local development

Use **two terminals**. Backend and frontend must run together.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # Windows: copy .env.example .env
# Edit .env — set Supabase keys at minimum
npm run dev
```

API: **http://localhost:5000** (override with `PORT` in `.env`).

> **macOS — port 5000 in use:** AirPlay Receiver can bind port 5000. Turn it off under **System Settings → General → AirDrop & Handoff → AirPlay Receiver**, or set `PORT=5001` in `backend/.env` and update `proxy.target` in `frontend/vite.config.js` to match.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env   # Windows: copy .env.example .env
# Edit .env — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

App: **http://localhost:5173** (Vite prints the exact URL).

`/api/*` requests are proxied to **http://localhost:5000** (see `frontend/vite.config.js`). Keep backend `PORT` and the proxy target aligned.

### Production-style API run

```bash
cd backend
npm start
```

---

## Verify it works

1. **API health** (backend running):

   ```bash
   curl http://localhost:5000/api/health
   ```

   Expected: `{"status":"ok","service":"Stokvel API"}`

2. **Frontend:** Open http://localhost:5173 — landing page loads.

3. **Auth:** Sign up / sign in (requires frontend Supabase env). After login, open **Dashboard** or create/join a group.

4. **Proxy:** With both servers running, the browser network tab should show `/api/...` requests succeeding (status 200), not HTML 404 from Vite.

---

## Testing & code quality

CI runs on pushes and pull requests to **`main`** (see `.github/workflows/codecov.yml`): backend and frontend tests with coverage uploaded to Codecov.

| Task                   | Command                  | Where            |
| ---------------------- | ------------------------ | ---------------- |
| Backend tests          | `npm test`               | `backend/`       |
| Backend coverage       | `npm test -- --coverage` | `backend/`       |
| Frontend tests (watch) | `npm test`               | `frontend/`      |
| Frontend tests (CI)    | `npm run test:run`       | `frontend/`      |
| Frontend coverage      | `npm run test:coverage`  | `frontend/`      |
| Lint                   | `npm run lint`           | `frontend/` only |

Tests use mocked Supabase/env where possible; you do not need live keys to run the suite, but integration behaviour should still be checked manually with real env files.

---

## Deployment

- **Backend:** Pushing to `main` triggers a [Render](https://render.com) deploy via `.github/workflows/render-deploy.yml` (requires `RENDER_DEPLOY_HOOK` secret). Production API example: `https://stokvel-backend-x0dm.onrender.com`.
- **Frontend:** Host the Vite build (`npm run build` → `frontend/dist`) on your static host (Vercel, Netlify, etc.). Set **`VITE_API_BASE_URL`** to the deployed API origin and Supabase vars to the same project.
- Set **`FRONTEND_URL`** on the backend to your production SPA URL (comma-separated if multiple origins).

---

## Contributing

1. Fork / branch from `main`.
2. Configure env files and run tests locally (see above).
3. Open a pull request with a clear description and test notes.

For bugs or features, open a GitHub issue with steps to reproduce and environment details (Node version, OS, relevant env vars **without secrets**).

---

## License

This project’s backend package declares **[ISC](backend/package.json)**. A root `LICENSE` file may be added later for the full monorepo; until then, refer to package metadata and your institution’s requirements.
