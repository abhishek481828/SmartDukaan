"use client";

import { useRef, useCallback, useEffect } from "react";
import { useVoiceStore } from "@/store/useVoiceStore";

const WS_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws") ?? "ws://localhost:8000";

export function useVoiceCapture(shopId: number | null) {
  const {
    setListening, setProcessing, setError, setSessionId,
    addUserMessage, addAssistantMessage, updateAssistantMessage,
    setTranscript, hydratePersistedSession,
  } = useVoiceStore();

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioQueueRef = useRef<Array<{ turnId: string; buffer: ArrayBuffer }>>([]);
  const isPlayingAudioRef = useRef(false);
  const currentMsgId = useRef<string | null>(null);
  const activeTurnIdRef = useRef<string | null>(null);
  const streamedText = useRef<string>("");
  const pendingStopRef = useRef<{ language: string } | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const stopAudioPlayback = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
    try {
      activeSourceRef.current?.stop();
    } catch {
      // Ignore stop errors from already-finished sources.
    }
    activeSourceRef.current = null;
  }, []);

  const processAudioQueue = useCallback(function processAudioQueueImpl() {
    if (isPlayingAudioRef.current) return;

    const next = audioQueueRef.current[0];
    if (!next) return;

    if (next.turnId !== activeTurnIdRef.current) {
      audioQueueRef.current.shift();
      processAudioQueueImpl();
      return;
    }

    void (async () => {
      try {
        if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
          audioCtxRef.current = new AudioContext();
        }
        const ctx = audioCtxRef.current;
        isPlayingAudioRef.current = true;
        const audioBuf = await ctx.decodeAudioData(next.buffer.slice(0));
        const src = ctx.createBufferSource();
        activeSourceRef.current = src;
        src.buffer = audioBuf;
        src.connect(ctx.destination);
        src.onended = () => {
          if (activeSourceRef.current === src) {
            activeSourceRef.current = null;
          }
          isPlayingAudioRef.current = false;
          if (audioQueueRef.current[0]?.turnId === next.turnId) {
            audioQueueRef.current.shift();
          }
          processAudioQueueImpl();
        };
        src.start();
      } catch (err) {
        console.warn("[Voice] Audio decode error:", err);
        isPlayingAudioRef.current = false;
        activeSourceRef.current = null;
        audioQueueRef.current.shift();
        processAudioQueueImpl();
      }
    })();
  }, []);

  const playAudio = useCallback(async (buffer: ArrayBuffer) => {
    try {
      const turnId = activeTurnIdRef.current;
      if (!turnId) return;

      audioQueueRef.current.push({ turnId, buffer });
      processAudioQueue();
    } catch (err) {
      console.warn("[Voice] Audio queue error:", err);
    }
  }, [processAudioQueue]);

  const ensureSocket = useCallback((): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      if (!shopId) {
        reject(new Error("Missing shop session"));
        return;
      }

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        resolve(wsRef.current);
        return;
      }

      const token = localStorage.getItem("bv_token");
      const wsUrl = new URL(`${WS_BASE}/ws/voice/${shopId}`);
      if (token) wsUrl.searchParams.set("token", token);

      const ws = new WebSocket(wsUrl.toString());
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        const { messages, sessionId } = useVoiceStore.getState();
        if (messages.length > 0 || sessionId) {
          ws.send(JSON.stringify({
            type: "hydrate_session",
            session_id: sessionId,
            history: messages.map((message) => ({
              role: message.role,
              text: message.text,
            })),
          }));
        }
        resolve(ws);
      };
      ws.onerror = () => reject(new Error("WebSocket connection failed"));

      ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          await playAudio(event.data);
          return;
        }

        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            session_id?: string;
            text?: string;
            token?: string;
            why?: string;
            what?: string;
            rupees_impact?: number;
            action?: {
              kind: string;
              status: string;
              requires_confirmation?: boolean;
              summary?: string;
              payload?: Record<string, unknown>;
              inventory?: Array<Record<string, unknown>>;
              transactions?: Array<Record<string, unknown>>;
            };
          };

          switch (msg.type) {
            case "session_start":
              if (msg.session_id) setSessionId(msg.session_id);
              break;

            case "transcript":
              if (msg.text) {
                addUserMessage(msg.text);
                setTranscript(msg.text);
              }
              break;

            case "thinking":
              setProcessing(true);
              currentMsgId.current = _genId();
              activeTurnIdRef.current = currentMsgId.current;
              stopAudioPlayback();
              streamedText.current = "";
              addAssistantMessage({ text: "", id: currentMsgId.current });
              break;

            case "chat_token":
              if (currentMsgId.current && msg.token) {
                streamedText.current += msg.token;
                updateAssistantMessage(currentMsgId.current, {
                  text: streamedText.current,
                });
              }
              break;

            case "chat_done":
              if (currentMsgId.current) {
                updateAssistantMessage(currentMsgId.current, {
                  text: msg.text ?? streamedText.current,
                  why: msg.why,
                  what: msg.what,
                  rupeesImpact: msg.rupees_impact,
                  action: msg.action,
                });
                if (msg.action?.status === "committed" && typeof window !== "undefined") {
                  localStorage.setItem("bv_dashboard_refresh", String(Date.now()));
                }
                currentMsgId.current = null;
                streamedText.current = "";
              }
              setProcessing(false);
              break;

            case "error":
              stopAudioPlayback();
              if ((msg.text ?? "").toLowerCase().includes("invalid token")) {
                localStorage.removeItem("bv_token");
                localStorage.removeItem("bv_user");
                localStorage.removeItem("bv_shop");
                setError("Session expired. Please sign in again.");
                ws.close();
                break;
              }
              setError(msg.text ?? "An error occurred");
              setProcessing(false);
              break;

            default:
              break;
          }
        } catch {
          // Ignore non-JSON frames.
        }
      };

      ws.onclose = () => {
        stopAudioPlayback();
        wsRef.current = null;
      };
    });
  }, [
    shopId,
    setSessionId,
    setProcessing,
    setError,
    setTranscript,
    addUserMessage,
    addAssistantMessage,
    updateAssistantMessage,
    playAudio,
    stopAudioPlayback,
  ]);

  const startVoice = useCallback(async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Mic permission denied. Please allow microphone access.");
      return;
    }
    streamRef.current = stream;

    let ws: WebSocket;
    try {
      ws = await ensureSocket();
    } catch {
      setError(shopId ? "Could not connect to SmartDukaan. Check your internet." : "Shop session not ready yet. Please wait a moment.");
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;
    recordedChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      if (ws.readyState === WebSocket.OPEN) {
        const inputBlob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || mimeType });
        const wavBuffer = await blobToWavArrayBuffer(inputBlob);
        ws.send(wavBuffer);
        ws.send(JSON.stringify({
          type: "end_of_speech",
          language: pendingStopRef.current?.language ?? "en",
          mime_type: "audio/wav",
        }));
      }

      recordedChunksRef.current = [];
      pendingStopRef.current = null;
    };

    recorder.start(250);
    setListening(true);
  }, [ensureSocket, setListening, setError, shopId]);

  const stopVoice = useCallback((language = "en") => {
    pendingStopRef.current = { language };
    recorderRef.current?.stop();
    recorderRef.current = null;
    setListening(false);
    setProcessing(true);
  }, [setListening, setProcessing]);

  const sendTextQuery = useCallback(async (text: string, language = "en") => {
    setError(null);
    let ws: WebSocket;
    try {
      ws = await ensureSocket();
    } catch {
      setError(shopId ? "Could not connect to SmartDukaan." : "Shop session not ready yet. Please wait a moment.");
      return;
    }
    ws.send(JSON.stringify({ type: "text_query", text, language }));
    setProcessing(true);
  }, [ensureSocket, setProcessing, setError, shopId]);

  const clearSession = useCallback(() => {
    stopAudioPlayback();
    activeTurnIdRef.current = null;
    currentMsgId.current = null;
    streamedText.current = "";
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "clear_session" }));
    }
  }, [stopAudioPlayback]);

  const disconnect = useCallback(() => {
    stopAudioPlayback();
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    activeTurnIdRef.current = null;
    currentMsgId.current = null;
    streamedText.current = "";
    pendingStopRef.current = null;
    setListening(false);
    setProcessing(false);
  }, [setListening, setProcessing, stopAudioPlayback]);

  useEffect(() => {
    hydratePersistedSession();
    return () => {
      disconnect();
    };
  }, [disconnect, hydratePersistedSession]);

  return { startVoice, stopVoice, sendTextQuery, clearSession, disconnect };
}

function _genId() {
  return Math.random().toString(36).slice(2, 8);
}

async function blobToWavArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  const sourceBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const audioBuffer = await audioContext.decodeAudioData(sourceBuffer.slice(0));
    return encodeWav(audioBuffer);
  } finally {
    await audioContext.close().catch(() => {});
  }
}

function encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const samples = audioBuffer.length;
  const blockAlign = numberOfChannels * bitDepth / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from({ length: numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
  let offset = 44;

  for (let i = 0; i < samples; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return buffer;
}

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}
