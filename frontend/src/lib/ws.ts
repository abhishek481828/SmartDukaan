// ============================================================
// WebSocket Manager — handles voice + dashboard push connections
// ============================================================

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export type WSMessageType =
  | "transcript"
  | "tts_chunk"
  | "filler"
  | "response_card"
  | "alert"
  | "forecast_update";

export interface WSMessage {
  type: WSMessageType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export function createVoiceWS(
  shopId: number,
  onMessage: (msg: WSMessage) => void,
  onError?: (err: Event) => void
) {
  const ws = new WebSocket(`${WS_URL}/ws/voice/${shopId}`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as WSMessage;
      onMessage(data);
    } catch {
      // Binary TTS chunk, handle differently if needed
      onMessage({ type: "tts_chunk", data: event.data });
    }
  };

  ws.onerror = (err) => {
    console.error("[VoiceWS] Error:", err);
    onError?.(err);
  };

  ws.onclose = () => {
    console.log("[VoiceWS] Connection closed");
  };

  return ws;
}

export function createDashboardWS(
  shopId: number,
  onMessage: (msg: WSMessage) => void
) {
  const ws = new WebSocket(`${WS_URL}/ws/dashboard/${shopId}`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as WSMessage;
      onMessage(data);
    } catch {
      console.warn("[DashboardWS] Failed to parse message");
    }
  };

  ws.onerror = (err) => {
    console.error("[DashboardWS] Error:", err);
  };

  return ws;
}
