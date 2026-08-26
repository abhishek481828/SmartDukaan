"""Voice WebSocket handler."""
from __future__ import annotations

import base64
import json
import os
import uuid

import httpx
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from agent.graph import run_agent
from core.auth_utils import decode_token
from db.database import async_session
from services.operations import handle_operational_query

router = APIRouter()

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"

_LANG_CODE_MAP = {
    "hi": "hi-IN",
    "en": "en-IN",
    "te": "te-IN",
    "ta": "ta-IN",
    "mr": "mr-IN",
}


def _lang_to_code(lang: str) -> str:
    return _LANG_CODE_MAP.get(lang, "en-IN")


@router.websocket("/ws/voice/{shop_id}")
async def voice_websocket(websocket: WebSocket, shop_id: int, token: str | None = Query(None)):
    await websocket.accept()

    if not token:
        await websocket.send_json({"type": "error", "text": "Unauthorized"})
        await websocket.close(code=1008)
        return

    try:
        payload = decode_token(token)
        if int(payload.get("shop_id", 0)) != shop_id:
            await websocket.send_json({"type": "error", "text": "Forbidden"})
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.send_json({"type": "error", "text": "Invalid token"})
        await websocket.close(code=1008)
        return

    session_id = str(uuid.uuid4())[:8]
    conversation_history: list[dict] = []
    audio_buffer = bytearray()
    language = "en"
    audio_mime_type = "audio/webm"
    pending_action: dict | None = None

    await websocket.send_json({"type": "session_start", "session_id": session_id})

    async def process_query(query: str, msg_id: str):
        nonlocal conversation_history, pending_action

        conversation_history.append({"role": "user", "text": query})
        await websocket.send_json({"type": "thinking"})

        try:
            streamed_any = False

            async def stream_token(sentence: str, audio: bytes | None):
                nonlocal streamed_any
                streamed_any = True
                await websocket.send_json({
                    "type": "chat_token",
                    "token": sentence if sentence.endswith(" ") else f"{sentence} ",
                    "msg_id": msg_id,
                })
                if audio:
                    await websocket.send_bytes(audio)

            async with async_session() as db:
                result = await handle_operational_query(
                    query,
                    shop_id=shop_id,
                    db=db,
                    pending_action=pending_action,
                )
                if not result:
                    result = await run_agent(
                        shop_id=shop_id,
                        transcript=query,
                        language=language,
                        db=db,
                        conversation_history=conversation_history,
                        on_stream=stream_token,
                    )

            why_text = result.get("why_text", "")
            what_text = result.get("what_text", "")
            rupees_impact = result.get("rupees_impact", 0)
            response_text = result.get("response_text", "") or f"{why_text} {what_text}".strip()
            action = result.get("action")
            pending_action = result.get("pending_action")

            if response_text and not streamed_any:
                await websocket.send_json({
                    "type": "chat_token",
                    "token": response_text,
                    "msg_id": msg_id,
                })

            await websocket.send_json({
                "type": "chat_done",
                "msg_id": msg_id,
                "text": response_text,
                "why": why_text,
                "what": what_text,
                "rupees_impact": rupees_impact,
                "action": action,
            })

            conversation_history.append({"role": "assistant", "text": response_text})

            if response_text and SARVAM_API_KEY and not streamed_any:
                for sentence in _split_sentences(response_text):
                    audio = await _run_tts(sentence, language)
                    if audio:
                        await websocket.send_bytes(audio)
        except Exception as exc:
            print(f"[VoiceWS] Pipeline error: {exc}")
            await websocket.send_json({"type": "error", "text": str(exc)})

    try:
        while True:
            try:
                data = await websocket.receive()
            except WebSocketDisconnect:
                break

            if "bytes" in data and data["bytes"]:
                audio_buffer.extend(data["bytes"])
                continue

            if "text" not in data or not data["text"]:
                continue

            try:
                msg = json.loads(data["text"])
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")

            if msg_type == "end_of_speech":
                if msg.get("language"):
                    language = msg["language"]
                if msg.get("mime_type"):
                    audio_mime_type = msg["mime_type"]

                if not audio_buffer:
                    await websocket.send_json({"type": "error", "text": "No audio received"})
                    continue

                transcript = await _run_stt(bytes(audio_buffer), language, audio_mime_type)
                audio_buffer.clear()
                if not transcript:
                    await websocket.send_json({"type": "error", "text": "Could not transcribe audio"})
                    continue

                msg_id = str(uuid.uuid4())[:8]
                await websocket.send_json({"type": "transcript", "text": transcript, "msg_id": msg_id})
                await process_query(transcript, msg_id)
                continue

            if msg_type == "text_query":
                query = str(msg.get("text", "")).strip()
                if msg.get("language"):
                    language = msg["language"]
                if not query:
                    continue

                msg_id = str(uuid.uuid4())[:8]
                await websocket.send_json({"type": "transcript", "text": query, "msg_id": msg_id})
                await process_query(query, msg_id)
                continue

            if msg_type == "hydrate_session":
                history = msg.get("history")
                incoming_session_id = msg.get("session_id")
                if isinstance(history, list):
                    conversation_history = [
                        {"role": item.get("role", "user"), "text": item.get("text", "")}
                        for item in history
                        if isinstance(item, dict) and item.get("text")
                    ]
                if incoming_session_id:
                    session_id = str(incoming_session_id)
                await websocket.send_json({"type": "session_start", "session_id": session_id})
                continue

            if msg_type == "clear_session":
                conversation_history = []
                pending_action = None
                session_id = str(uuid.uuid4())[:8]
                await websocket.send_json({"type": "session_start", "session_id": session_id})
                continue

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        print(f"[VoiceWS] shop={shop_id} session={session_id} disconnected")
    except Exception as exc:
        print(f"[VoiceWS] Fatal error: {exc}")
        try:
            await websocket.send_json({"type": "error", "text": str(exc)})
        except Exception:
            pass


def _mime_to_filename(mime_type: str) -> str:
    if "ogg" in mime_type:
        return "audio.ogg"
    if "wav" in mime_type:
        return "audio.wav"
    if "mp4" in mime_type or "mpeg" in mime_type:
        return "audio.m4a"
    return "audio.webm"


async def _run_stt(audio_bytes: bytes, language: str = "en", mime_type: str = "audio/webm") -> str | None:
    if not SARVAM_API_KEY:
        raise RuntimeError("SARVAM_API_KEY is not configured for real STT operation.")

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                SARVAM_STT_URL,
                headers={"api-subscription-key": SARVAM_API_KEY},
                files={"file": (_mime_to_filename(mime_type), audio_bytes, mime_type)},
                data={
                    "model": "saaras:v3",
                    "mode": "translate",
                    "with_timestamps": "false",
                },
            )
            if response.status_code == 200:
                return response.json().get("transcript", "")
            print(f"[STT] Non-200: {response.status_code} {response.text[:200]}")
    except Exception as exc:
        print(f"[STT] Error: {exc}")
    return None


async def _run_tts(text: str, language: str = "en") -> bytes | None:
    if not SARVAM_API_KEY or not text.strip():
        return None

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                SARVAM_TTS_URL,
                headers={
                    "api-subscription-key": SARVAM_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "text": text[:500],
                    "target_language_code": _lang_to_code(language),
                    "speaker": "shubh",
                    "model": "bulbul:v3",
                },
            )
            if response.status_code == 200:
                audios = response.json().get("audios", [])
                if audios:
                    return base64.b64decode(audios[0])
            print(f"[TTS] Non-200: {response.status_code} {response.text[:200]}")
    except Exception as exc:
        print(f"[TTS] Error: {exc}")
    return None


def _split_sentences(text: str) -> list[str]:
    import re

    parts = re.split(r"(?<=[।.!?])\s+|\n", text)
    return [part.strip() for part in parts if part.strip()]
