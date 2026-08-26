"""Streaming pipeline service — Groq streaming + sentence-level TTS.

This is SmartDukaan Latency Fix 3 from the Developer Reference §10.

Instead of waiting for the full LLM response before synthesising audio,
we detect sentence boundaries in the streamed tokens and fire TTS
on each completed sentence. This reduces time-to-first-audio from ~7s → ~1.4s.

Usage (inside a WebSocket handler):

    async for sentence, audio_bytes in stream_response_with_tts(prompt, language):
        # 1. Send text chunk to client immediately
        await ws.send_json({"type": "chat_token", "token": sentence})
        # 2. Send TTS audio bytes immediately (client plays as it arrives)
        if audio_bytes:
            await ws.send_bytes(audio_bytes)
"""

import asyncio
import base64
import os
import re
from typing import AsyncGenerator

import httpx

GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"

_LANG_CODE_MAP = {
    "hi": "hi-IN", "en": "en-IN", "te": "te-IN",
    "ta": "ta-IN", "mr": "mr-IN",
}

# Sentence boundary pattern (Hindi danda + punctuation)
_SENTENCE_RE = re.compile(r"(?<=[।.!?])\s+|(?<=\n)")


def _lang_code(lang: str) -> str:
    return _LANG_CODE_MAP.get(lang, "en-IN")


async def stream_response_with_tts(
    messages: list[dict],
    language: str = "en",
) -> AsyncGenerator[tuple[str, bytes | None], None]:
    """Stream Groq tokens and yield (sentence, tts_audio_or_None) pairs.

    Each yielded pair contains:
      - sentence: a complete sentence (or final partial buffer)
      - audio: raw WAV bytes from Sarvam TTS, or None if TTS unavailable

    Caller should send sentence as text and audio as binary simultaneously.
    """
    if not GROQ_API_KEY:
        # Dev fallback — yield a canned response
        fallback = "Namaste! Aapke sawal ka jawab yeh hai: Apna rice ka daam ₹2 kam karein. Is hafte ₹1,400 extra kamaoge."
        audio = await _tts(fallback, language)
        yield fallback, audio
        return

    buffer = ""
    full_text = ""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream(
                "POST",
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": os.getenv("GROQ_MODEL", "groq/compound"),
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 400,
                    "stream": True,
                },
            ) as resp:
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    payload = line[6:]
                    if payload.strip() == "[DONE]":
                        break
                    try:
                        import json
                        chunk = json.loads(payload)
                        token = chunk["choices"][0]["delta"].get("content", "")
                        if not token:
                            continue
                    except Exception:
                        continue

                    buffer += token
                    full_text += token

                    # Check for sentence boundary
                    parts = _SENTENCE_RE.split(buffer)
                    if len(parts) > 1:
                        # All parts except the last are complete sentences
                        for sentence in parts[:-1]:
                            sentence = sentence.strip()
                            if sentence:
                                audio = await _tts(sentence, language)
                                yield sentence, audio
                        buffer = parts[-1]   # keep remainder for next iteration

        # Flush remaining buffer
        if buffer.strip():
            audio = await _tts(buffer.strip(), language)
            yield buffer.strip(), audio

    except Exception as e:
        print(f"[StreamPipeline] Groq stream error: {e}")
        # Yield error as text, no audio
        yield f"Error: {e}", None


async def _tts(text: str, language: str) -> bytes | None:
    """Call Sarvam TTS and return raw audio bytes."""
    if not SARVAM_API_KEY or not text.strip():
        return None
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(
                SARVAM_TTS_URL,
                headers={
                    "api-subscription-key": SARVAM_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "text": text[:500],
                    "target_language_code": _lang_code(language),
                    "speaker": "shubh",
                    "model": "bulbul:v3",
                },
            )
            if resp.status_code == 200:
                audios = resp.json().get("audios", [])
                if audios:
                    return base64.b64decode(audios[0])
    except Exception as e:
        print(f"[StreamPipeline] TTS error: {e}")
    return None


async def run_streaming_pipeline(
    messages: list[dict],
    language: str,
    on_token: "asyncio.coroutines.CoroutineType | None" = None,
) -> str:
    """Convenience wrapper: collect all tokens, call on_token callback per sentence.

    Returns the full response text.
    """
    full_text = ""
    async for sentence, audio in stream_response_with_tts(messages, language):
        full_text += sentence + " "
        if on_token:
            await on_token(sentence, audio)
    return full_text.strip()
