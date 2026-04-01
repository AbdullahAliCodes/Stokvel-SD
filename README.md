# Stokvel Management System

Split-stack app: React (Vite) frontend and Node.js (Express) backend.

## Prerequisites

- Node.js 18+ recommended
- npm

## Backend (Express)

From the repository root:

```bash
cd backend
npm install
npm run dev
```

The API listens on **http://localhost:5000** (override with the `PORT` environment variable). On some Macs, AirPlay Receiver uses port 5000; turn it off in System Settings → AirDrop & Handoff if the server fails to bind. If you change `PORT`, update the `proxy.target` in `frontend/vite.config.js` to match.

For production-style runs:

```bash
npm start
```

## Frontend (Vite + React)

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

The dev server prints the local URL (typically **http://localhost:5173**). Requests to `/api/*` are proxied to the backend on port 5000.

Run both servers together during development so the frontend can reach the API.
