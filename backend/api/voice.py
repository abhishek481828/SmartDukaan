"""Voice routes — production implementation.

POST /api/voice/query → runs LangGraph agent, returns WHY/WHAT/₹
POST /api/voice/stt   → proxy to Sarvam STT API
POST /api/voice/tts   → proxy to Sarvam TTS API

Ref: BACKEND_STRUCTURE.md Section 4 (Voice endpoints)
"""
import os
import httpx
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from core.auth_utils import get_current_user, TokenData
from agent.graph import run_agent

router = APIRouter()

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"  # saaras:v3 endpoint
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"

# Sarvam BCP-47 language codes
_LANG_CODE_MAP = {
    "hi": "hi-IN",
    "en": "en-IN",
    "te": "te-IN",
    "ta": "ta-IN",
    "mr": "mr-IN",
    "kn": "kn-IN",
    "gu": "gu-IN",
    "bn": "bn-IN",
}


def _lang_to_code(lang: str) -> str:
    """Convert short lang code to BCP-47 for Sarvam API."""
    return _LANG_CODE_MAP.get(lang, "en-IN")


class VoiceQueryRequest(BaseModel):
    transcript: str
    language: str = "en"


class TTSRequest(BaseModel):
    text: str
    language: str = "en"
    voice: str = "shubh"  # bulbul:v3 speakers are lowercase: shubh, priya, meera, ritu, etc.


@router.post("/query")
async def voice_query(
    req: VoiceQueryRequest,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Core voice Q&A: transcript → LangGraph agent → WHY/WHAT/₹."""
    result = await run_agent(
        shop_id=current_user.shop_id,
        transcript=req.transcript,
        language=req.language,
        db=db,
    )

    return {
        "transcript": req.transcript,
        "why_text": result.get("why_text", ""),
        "what_text": result.get("what_text", ""),
        "rupees_impact": result.get("rupees_impact", 0),
        "response_text": result.get("response_text", ""),
        "alert_id": result.get("alert_id"),
    }


@router.post("/stt")
async def proxy_stt(
    audio: UploadFile = File(...),
    current_user: TokenData = Depends(get_current_user),
):
    """Proxy to Sarvam STT — keeps API key server-side."""
    if not SARVAM_API_KEY:
        raise HTTPException(status_code=503, detail="STT service not configured")

    audio_bytes = await audio.read()

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                SARVAM_STT_URL,
                headers={
                    "api-subscription-key": SARVAM_API_KEY,
                },
                files={
                    "file": (audio.filename or "audio.wav", audio_bytes, audio.content_type or "audio/wav"),
                },
                data={
                    "model": "saaras:v3",
                    "mode": "translate",
                    "with_timestamps": "false",
                },
            )

            if resp.status_code != 200:
                raise HTTPException(
                    status_code=503,
                    detail={"error": {"code": "AI_ERROR", "message": f"Sarvam STT error: {resp.status_code}"}},
                )

            data = resp.json()
            return {
                "transcript": data.get("transcript", ""),
                "language_detected": data.get("language_code", "en-IN"),
            }

    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="STT request timed out")


@router.post("/tts")
async def proxy_tts(
    req: TTSRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """Proxy to Sarvam TTS — returns audio/wav binary stream."""
    if not SARVAM_API_KEY:
        raise HTTPException(status_code=503, detail="TTS service not configured")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                SARVAM_TTS_URL,
                headers={
                    "api-subscription-key": SARVAM_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "text": req.text,                         # field is 'text', not 'inputs'
                    "target_language_code": _lang_to_code(req.language),
                    "speaker": req.voice.lower(),             # bulbul:v3 uses lowercase speakers
                    "model": "bulbul:v3",
                },
            )

            if resp.status_code != 200:
                raise HTTPException(
                    status_code=503,
                    detail={"error": {"code": "AI_ERROR", "message": f"Sarvam TTS error: {resp.status_code}"}},
                )

            data = resp.json()
            audios = data.get("audios", [])

            if audios:
                # Sarvam returns base64-encoded audio
                import base64
                audio_bytes = base64.b64decode(audios[0])
                return StreamingResponse(
                    iter([audio_bytes]),
                    media_type="audio/wav",
                    headers={"Content-Disposition": "inline"},
                )

            return {"error": "No audio generated"}

    except httpx.TimeoutException:
        raise HTTPException(status_code=503, detail="TTS request timed out")
