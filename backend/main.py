"""
SmartDukaan Backend — FastAPI Application Entry Point

Run: uvicorn main:app --reload --port 8000
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(Path(__file__).with_name(".env"))

from db.database import init_db
from api import alerts, auth, dashboard, sales, forecast, market, invoice, simulate, voice, settings, inventory


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    # Startup: initialize database tables
    await init_db()
    print("[SmartDukaan] Database initialized")

    # Auto-seed demo data if database is fresh
    try:
        from db.database import async_session
        from db.models import User
        from sqlalchemy import select
        async with async_session() as db:
            result = await db.execute(select(User))
            if not result.scalars().first():
                print("[SmartDukaan] Auto-seeding demo shop data...")
                from db.demo_preload import preload_demo
                await preload_demo()
    except Exception as e:
        print(f"[SmartDukaan] Auto-seed check failed: {e}")


    # Start background scheduler
    try:
        from scheduler.jobs import start_scheduler
        scheduler = start_scheduler()
    except Exception as e:
        print(f"[SmartDukaan] Scheduler failed to start: {e}")
        scheduler = None

    yield

    # Shutdown
    if scheduler:
        scheduler.shutdown(wait=False)
    print("[SmartDukaan] Shutting down")


app = FastAPI(
    title="SmartDukaan API",
    description="Voice-First AI Retail Operating System for Kirana Stores",
    version="0.1.0",
    lifespan=lifespan,
)


# Global exception handler — consistent error format
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred",
            }
        },
    )


# CORS
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST Routes
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(alerts.router, prefix="/api", tags=["Alerts"])
app.include_router(dashboard.router, prefix="/api", tags=["Dashboard"])
app.include_router(sales.router, prefix="/api/sales", tags=["Sales"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["Inventory"])
app.include_router(forecast.router, prefix="/api", tags=["Forecast"])
app.include_router(market.router, prefix="/api/market", tags=["Market"])
app.include_router(invoice.router, prefix="/api/invoice", tags=["Invoice"])
app.include_router(simulate.router, prefix="/api", tags=["Simulate"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])
app.include_router(settings.router, prefix="/api/settings", tags=["Settings"])

# WebSocket Routes
from ws.voice_handler import router as voice_ws_router
from ws.dashboard_handler import router as dashboard_ws_router

app.include_router(voice_ws_router)
app.include_router(dashboard_ws_router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "SmartDukaan API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
