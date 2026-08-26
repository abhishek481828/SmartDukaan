# SmartDukaan

SmartDukaan is a voice-first retail operating system for Indian kirana-style businesses. It combines a FastAPI backend, a Next.js frontend, live voice/chat flows, inventory and invoice tooling, alerting, forecasting, and WhatsApp notifications.

## Stack

- Frontend: Next.js 16, React 19, Tailwind CSS, Framer Motion, Zustand, Recharts
- Backend: FastAPI, SQLAlchemy, APScheduler, WebSockets
- AI services: Groq, Sarvam, Tavily
- Data: SQLite for local development, PostgreSQL-compatible `DATABASE_URL` for production
- Messaging: Twilio WhatsApp templates

## Repository Layout

```text
backend/   FastAPI app, DB models, ML, scheduler, services, WebSockets
frontend/  Next.js app router frontend
docs/      Additional project docs
```

## Current Product Areas

- Auth and onboarding
- Dashboard and product performance
- Alerts and manual alert scans
- Inventory and transaction history
- Invoicing and PDF generation
- Forecast views
- Voice assistant over WebSocket
- Settings, CSV/OCR import flows, and WhatsApp alert settings

## Local Development

### 1. Backend

From [`backend`](/d:/Cat/backend):

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

Important backend routes:

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/dashboard`
- `GET /api/alerts`
- `POST /api/alerts/run`
- `GET /api/inventory`
- `POST /api/inventory/adjust`
- `POST /api/invoice/generate`
- `GET /api/settings/profile`

### 2. Frontend

From [`frontend`](/d:/Cat/frontend):

```bash
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:8000` by default.

## Frontend Environment

Create [`frontend/.env.local`](/d:/Cat/frontend/.env.local):

```env
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

## Backend Environment

Use [`backend/.env.example`](/d:/Cat/backend/.env.example) as the base.

Typical minimum local config:

```env
DATABASE_URL=sqlite+aiosqlite:///./smartdukaan.db
JWT_SECRET=change-me
JWT_ALGORITHM=HS256
JWT_EXPIRY_DAYS=7
HOST=0.0.0.0
PORT=8000
CORS_ORIGINS=http://localhost:3000
```

Optional integrations:

- `SARVAM_API_KEY` for STT/TTS
- `GROQ_API_KEY` for LLM responses
- `TAVILY_API_KEY` for web/news context
- `AGMARKNET_API_KEY` for mandi price refresh
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_CONTENT_SID`, `TWILIO_WHATSAPP_FROM` for WhatsApp alerts

## Build and Verification

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Backend:

```bash
python -m compileall d:\Cat\backend
```

## Deployment

### Frontend on Vercel

- Root directory: `frontend`
- Build command:

```bash
npm run build
```

- Required frontend envs:

```env
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_API_URL=https://your-backend-domain.com
NEXT_PUBLIC_WS_URL=wss://your-backend-domain.com
```

### Backend on Render

- Root directory: `backend`
- Build command:

```bash
pip install -r requirements.txt
```

- Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

- Update `CORS_ORIGINS` to include your Vercel domain

## Notes

- SQLite is fine for local development, but production should use Postgres.
- Twilio sandbox recipients must join the sandbox before WhatsApp test sends will work.
- Tavily quota/external API availability affects news-driven risk alerts.
- The current agent flow uses parallel fetch branches, but it is not a full multi-agent LangGraph orchestration.

## Main Commands

```bash
# frontend
cd frontend
npm run dev
npm run build

# backend
cd backend
uvicorn main:app --reload --port 8000
```
