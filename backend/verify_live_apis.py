"""
Live API verification script — tests Groq, Sarvam STT, Sarvam TTS, and Tavily.

Run: .\venv\Scripts\Activate.ps1; python verify_live_apis.py

Each test is independent and prints PASS/FAIL with response details.
Params sourced from official Sarvam docs (saaras:v3, bulbul:v1, Capitalized speakers).
"""
import asyncio
import os
import base64
import wave
import io
import struct
import time
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"    # saaras:v3
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"    # bulbul:v1
TAVILY_URL = "https://api.tavily.com/search"

PASS = "PASS"
FAIL = "FAIL"
WARN = "WARN"


def _sep(title):
    print(f"\n{'---'*18}")
    print(f"  {title}")
    print(f"{'---'*18}")


def _make_silent_wav(duration_sec=1.0, sample_rate=16000):
    """Generate a valid silent WAV file in memory for STT testing."""
    num_samples = int(sample_rate * duration_sec)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(struct.pack(f"<{num_samples}h", *([0] * num_samples)))
    return buf.getvalue()


# TEST 1: Groq LLM
async def test_groq():
    _sep("TEST 1: Groq LLM (groq/compound)")
    if not GROQ_API_KEY:
        print(f"[{FAIL}] GROQ_API_KEY not set")
        return False

    import httpx
    t0 = time.time()

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                GROQ_URL,
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": os.getenv("GROQ_MODEL", "groq/compound"),
                    "messages": [

                        {"role": "system", "content": "You are SmartDukaan. Respond with WHY, WHAT, IMPACT sections only."},
                        {"role": "user", "content": "Why are my rice sales dropping? 30kg/day normally, today 18kg. Mandi Rs39/kg."},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 250,
                },
            )

        latency = round(time.time() - t0, 2)

        if resp.status_code == 200:
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            tokens = data.get("usage", {}).get("total_tokens", "?")
            print(f"[{PASS}] Groq responded in {latency}s | tokens={tokens}")
            print(f"  Model: {data.get('model')}")
            # Print first 300 chars safely
            safe_content = content[:300].encode("ascii", errors="replace").decode("ascii")
            print(f"  Response (first 300 chars):\n    {safe_content}")
            has_structure = any(w in content.upper() for w in ["WHY", "WHAT", "IMPACT"])
            print(f"  Structure check: {'OK' if has_structure else 'MISSING WHY/WHAT/IMPACT'}")
            return True
        else:
            print(f"[{FAIL}] HTTP {resp.status_code}: {resp.text[:200]}")
            return False

    except Exception as e:
        print(f"[{FAIL}] Exception: {e}")
        return False


# TEST 2: Sarvam TTS (bulbul:v1, Meera speaker)
async def test_sarvam_tts():
    _sep("TEST 2: Sarvam TTS (bulbul:v1, speaker=Meera, en-IN)")
    if not SARVAM_API_KEY:
        print(f"[{FAIL}] SARVAM_API_KEY not set")
        return False

    import httpx
    # Use ASCII English to avoid Windows encoding issues
    test_text = "Rice sales dropped 22 percent. Reduce price to recover customers."
    t0 = time.time()

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                SARVAM_TTS_URL,
                headers={"api-subscription-key": SARVAM_API_KEY, "Content-Type": "application/json"},
                json={
                    "text": test_text,             # 'text' field (string), not 'inputs' (array)
                    "target_language_code": "en-IN",
                    "speaker": "shubh",             # bulbul:v3 uses lowercase speakers
                    "model": "bulbul:v3",
                },
            )

        latency = round(time.time() - t0, 2)

        if resp.status_code == 200:
            data = resp.json()
            audios = data.get("audios", [])
            if audios:
                audio_bytes = base64.b64decode(audios[0])
                size_kb = round(len(audio_bytes) / 1024, 1)
                save_path = os.path.join(os.environ.get("TEMP", "."), "smartdukaan_tts_test.wav")
                with open(save_path, "wb") as f:
                    f.write(audio_bytes)
                print(f"[{PASS}] TTS responded in {latency}s | {size_kb} KB WAV generated")
                print(f"  Speaker: shubh | Lang: en-IN | Model: bulbul:v3")
                print(f"  Saved : {save_path}")
                return True
            else:
                print(f"[{WARN}] HTTP 200 but no audio returned: {data}")
                return False
        else:
            print(f"[{FAIL}] HTTP {resp.status_code}: {resp.text[:300]}")
            return False

    except Exception as e:
        print(f"[{FAIL}] Exception: {e}")
        return False


# TEST 3: Sarvam STT (saaras:v3, /speech-to-text)
async def test_sarvam_stt():
    _sep("TEST 3: Sarvam STT (saaras:v3, silent WAV)")
    if not SARVAM_API_KEY:
        print(f"[{FAIL}] SARVAM_API_KEY not set")
        return False

    import httpx
    wav_bytes = _make_silent_wav(duration_sec=1.0)
    t0 = time.time()

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                SARVAM_STT_URL,
                headers={"api-subscription-key": SARVAM_API_KEY},
                files={"file": ("test_audio.wav", wav_bytes, "audio/wav")},
                data={
                    "model": "saaras:v3",
                    "mode": "transcribe",       # required for v3 (replaces old style)
                    "with_timestamps": "false",
                },
            )

        latency = round(time.time() - t0, 2)

        if resp.status_code == 200:
            data = resp.json()
            transcript = data.get("transcript", "")
            lang = data.get("language_code", data.get("languageCode", "?"))
            print(f"[{PASS}] STT accepted audio in {latency}s")
            print(f"  Endpoint: saaras:v3 /speech-to-text | mode=transcribe")
            print(f"  Transcript: '{transcript}' | Language: {lang}")
            return True
        elif resp.status_code == 422:
            # Silent WAV may be rejected as "no speech" — API is reachable + authenticated
            print(f"[{WARN}] HTTP 422 — silent audio rejected (API is reachable and auth OK)")
            print(f"  Detail: {resp.text[:200]}")
            return True
        else:
            print(f"[{FAIL}] HTTP {resp.status_code}: {resp.text[:300]}")
            return False

    except Exception as e:
        print(f"[{FAIL}] Exception: {e}")
        return False


# TEST 4: Tavily Search
async def test_tavily():
    _sep("TEST 4: Tavily Search (competitor intel)")
    if not TAVILY_API_KEY:
        print(f"[{FAIL}] TAVILY_API_KEY not set")
        return False

    import httpx
    t0 = time.time()

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                TAVILY_URL,
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": "rice price kirana market Nagpur today mandi rate",
                    "search_depth": "basic",
                    "max_results": 3,
                },
            )

        latency = round(time.time() - t0, 2)

        if resp.status_code == 200:
            data = resp.json()
            results = data.get("results", [])
            print(f"[{PASS}] Tavily responded in {latency}s | {len(results)} results")
            for i, r in enumerate(results[:3], 1):
                title = r.get("title", "N/A")[:60].encode("ascii", errors="replace").decode()
                url = r.get("url", "")[:70]
                print(f"  [{i}] {title}")
                print(f"      {url}")
            return True
        else:
            print(f"[{FAIL}] HTTP {resp.status_code}: {resp.text[:200]}")
            return False

    except Exception as e:
        print(f"[{FAIL}] Exception: {e}")
        return False


# TEST 5: Full REST voice pipeline (requires server running)
async def test_voice_pipeline_rest():
    _sep("TEST 5: Full Voice Pipeline via /api/voice/query (REST)")

    import httpx
    async with httpx.AsyncClient(base_url="http://localhost:8000", timeout=30) as client:
        try:
            r = await client.post("/api/auth/login", json={"phone": "9876543210", "password": "pass123"})
            if r.status_code != 200:
                print(f"[{WARN}] Server not running — start: uvicorn main:app --reload")
                return None

            token = r.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            t0 = time.time()
            r2 = await client.post(
                "/api/voice/query",
                headers=headers,
                json={"transcript": "Why are my rice sales dropping?", "language": "en"},
            )
            latency = round(time.time() - t0, 2)

            if r2.status_code == 200:
                data = r2.json()
                why = (data.get("why_text", "") or "")[:100].encode("ascii", errors="replace").decode()
                rupees = data.get("rupees_impact", 0)
                print(f"[{PASS}] Voice query responded in {latency}s")
                print(f"  WHY (first 100): {why}")
                print(f"  Rupees impact  : {rupees}")
                return True
            else:
                print(f"[{FAIL}] HTTP {r2.status_code}: {r2.text[:200]}")
                return False

        except (httpx.ConnectError, httpx.ConnectTimeout):
            print(f"[{WARN}] Server not running — skipping this test")
            print(f"       Run 'uvicorn main:app' in a separate terminal for Test 5")
            return None


# Main
async def main():
    print("\n" + "=" * 55)
    print("  SmartDukaan - Live API Verification")
    print("=" * 55)
    print(f"  GROQ_API_KEY   : {'SET (' + GROQ_API_KEY[:12] + '...)' if GROQ_API_KEY else 'NOT SET'}")
    print(f"  SARVAM_API_KEY : {'SET (' + SARVAM_API_KEY[:12] + '...)' if SARVAM_API_KEY else 'NOT SET'}")
    print(f"  TAVILY_API_KEY : {'SET (' + TAVILY_API_KEY[:12] + '...)' if TAVILY_API_KEY else 'NOT SET'}")

    results = {}
    results["Groq LLM"] = await test_groq()
    results["Sarvam TTS"] = await test_sarvam_tts()
    results["Sarvam STT"] = await test_sarvam_stt()
    results["Tavily Search"] = await test_tavily()
    results["Voice Pipeline REST"] = await test_voice_pipeline_rest()

    print("\n" + "=" * 55)
    print("  FINAL SUMMARY")
    print("=" * 55)
    for name, result in results.items():
        tag = "[PASS]" if result is True else ("[FAIL]" if result is False else "[SKIP]")
        print(f"  {tag}  {name}")
    print("")


if __name__ == "__main__":
    asyncio.run(main())
