"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useVoiceStore, type ChatMessage } from "@/store/useVoiceStore";
import { useShopStore } from "@/store/useShopStore";
import { useVoiceCapture } from "@/hooks/useVoiceCapture";

interface Props {
  open: boolean;
  initialPrompt?: string | null;
  onPromptConsumed?: () => void;
  onClose: () => void;
}

function resolveShopId(storedShopId: number | null): number | null {
  if (storedShopId) return storedShopId;
  if (typeof window === "undefined") return null;

  const rawShop = localStorage.getItem("bv_shop");
  if (rawShop) {
    try {
      const parsed = JSON.parse(rawShop) as { id?: number };
      if (parsed.id) return parsed.id;
    } catch {}
  }

  const token = localStorage.getItem("bv_token");
  if (!token) return null;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const payload = JSON.parse(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"))) as { shop_id?: number };
    return payload.shop_id ?? null;
  } catch {
    return null;
  }
}

function MicButton({
  listening,
  disabled,
  onClick,
}: {
  listening: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={listening ? "Stop recording" : "Start recording"}
      className="relative flex items-center justify-center shrink-0 transition-all duration-200 disabled:cursor-not-allowed"
      style={{
        width: 52,
        height: 52,
        borderRadius: "18px",
        background: listening
          ? "linear-gradient(135deg, rgba(194,65,12,0.96), rgba(154,52,18,0.96))"
          : "rgba(255,252,248,0.82)",
        border: listening
          ? "1px solid rgba(194,65,12,0.32)"
          : "1px solid rgba(154,52,18,0.12)",
        boxShadow: listening
          ? "0 16px 32px rgba(194,65,12,0.24), inset 0 1px 0 rgba(255,255,255,0.24)"
          : "inset 0 1px 0 rgba(255,255,255,0.52)",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={listening ? "white" : "#9a3412"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}

function DotLoader() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block rounded-full"
          style={{
            width: 6,
            height: 6,
            background: i === 1 ? "#0369a1" : "#c2410c",
            animation: `voice-bounce 1.1s ease-in-out ${i * 0.12}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function formatActionLine(value: unknown) {
  if (typeof value === "number") return value.toLocaleString("en-IN");
  if (typeof value === "string") return value;
  return "";
}

function ChatBubble({
  msg,
  onQuickAction,
}: {
  msg: ChatMessage;
  onQuickAction: (text: string) => void;
}) {
  const isUser = msg.role === "user";
  const actionPayload = msg.action?.payload as Record<string, unknown> | undefined;
  const inventoryList = (msg.action?.inventory ?? []) as Array<Record<string, unknown>>;
  const transactionList = (msg.action?.transactions ?? []) as Array<Record<string, unknown>>;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {!isUser && (
        <div
          className="mr-3 mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-sm font-black text-white"
          style={{
            borderRadius: "14px",
            background: "linear-gradient(135deg, #c2410c, #9a3412)",
            boxShadow: "0 14px 26px rgba(194,65,12,0.22)",
          }}
        >
          B
        </div>
      )}

      <div style={{ maxWidth: "min(78%, 520px)" }}>
        <div
          className="px-4 py-3"
          style={{
            borderRadius: isUser ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
            background: isUser
              ? "linear-gradient(135deg, rgba(194,65,12,0.96), rgba(154,52,18,0.96))"
              : "rgba(255,252,248,0.9)",
            border: isUser
              ? "1px solid rgba(194,65,12,0.22)"
              : "1px solid rgba(154,52,18,0.12)",
            boxShadow: isUser
              ? "0 14px 30px rgba(194,65,12,0.18)"
              : "inset 0 1px 0 rgba(255,255,255,0.52)",
            backdropFilter: "blur(14px)",
          }}
        >
          {msg.text ? (
            <p
              className="text-sm leading-7"
              style={{ color: isUser ? "white" : "#1a1a1a" }}
            >
              {msg.text}
              {!isUser && !msg.why && msg.text && (
                <span
                  className="ml-1 inline-block align-middle"
                  style={{
                    width: 6,
                    height: 14,
                    borderRadius: 999,
                    background: "linear-gradient(180deg, #c2410c, #0369a1)",
                    animation: "voice-blink 1s step-end infinite",
                  }}
                />
              )}
            </p>
          ) : (
            <DotLoader />
          )}
        </div>




        {!isUser && msg.action && (
          <div className="mt-2 grid gap-2">
            {msg.action.summary && (
              <div
                className="px-3 py-3"
                style={{
                  borderRadius: "18px",
                  background: "rgba(255,252,248,0.86)",
                  border: "1px solid rgba(154,52,18,0.12)",
                }}
              >
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "#737373" }}>
                  Action
                </p>
                <p className="text-xs leading-6" style={{ color: "#1a1a1a" }}>
                  {msg.action.summary}
                </p>
              </div>
            )}

            {actionPayload && Object.keys(actionPayload).length > 0 && (
              <div
                className="grid gap-1 px-3 py-3 text-xs"
                style={{
                  borderRadius: "18px",
                  background: "rgba(3,105,161,0.06)",
                  border: "1px solid rgba(3,105,161,0.14)",
                  color: "#1a1a1a",
                }}
              >
                {Object.entries(actionPayload)
                  .filter(([key]) => !["items", "inventory", "transactions"].includes(key))
                  .slice(0, 6)
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <span className="uppercase tracking-[0.2em]" style={{ color: "#0369a1" }}>
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="text-right">{formatActionLine(value)}</span>
                    </div>
                  ))}
              </div>
            )}

            {Array.isArray(actionPayload?.items) && actionPayload.items.length > 0 && (
              <div
                className="grid gap-2 px-3 py-3"
                style={{
                  borderRadius: "18px",
                  background: "rgba(194,65,12,0.06)",
                  border: "1px solid rgba(194,65,12,0.14)",
                }}
              >
                {(actionPayload.items as Array<Record<string, unknown>>).map((item, index) => (
                  <div key={`${msg.id}-item-${index}`} className="flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p style={{ color: "#1a1a1a" }}>{formatActionLine(item.product)}</p>
                      <p style={{ color: "#4a4a4a" }}>
                        {formatActionLine(item.qty)} x Rs.{formatActionLine(item.unit_price)}
                      </p>
                    </div>
                    <p className="font-bold text-[var(--color-accent)]">Rs.{formatActionLine(item.amount)}</p>
                  </div>
                ))}
              </div>
            )}

            {inventoryList.length > 0 && (
              <div
                className="grid gap-2 px-3 py-3"
                style={{
                  borderRadius: "18px",
                  background: "rgba(255,252,248,0.86)",
                  border: "1px solid rgba(154,52,18,0.12)",
                }}
              >
                {inventoryList.slice(0, 5).map((item, index) => (
                  <div key={`${msg.id}-inventory-${index}`} className="flex items-center justify-between text-xs">
                    <span style={{ color: "#1a1a1a" }}>{formatActionLine(item.name)}</span>
                    <span style={{ color: "#4a4a4a" }}>
                      {formatActionLine(item.in_stock)} {formatActionLine(item.unit)} / {formatActionLine(item.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {transactionList.length > 0 && (
              <div
                className="grid gap-2 px-3 py-3"
                style={{
                  borderRadius: "18px",
                  background: "rgba(255,252,248,0.86)",
                  border: "1px solid rgba(154,52,18,0.12)",
                }}
              >
                {transactionList.slice(0, 5).map((item, index) => (
                  <div key={`${msg.id}-tx-${index}`} className="flex items-center justify-between text-xs gap-3">
                    <span style={{ color: "#1a1a1a" }}>{formatActionLine(item.product_name)}</span>
                    <span style={{ color: "#4a4a4a" }}>
                      {formatActionLine(item.transaction_type)} {formatActionLine(item.quantity_delta)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {msg.action.requires_confirmation && (
              <div className="flex gap-2">
                <button
                  onClick={() => onQuickAction("confirm")}
                  className="px-4 py-2 text-xs font-semibold text-white"
                  style={{
                    borderRadius: "999px",
                    background: "linear-gradient(135deg, #c2410c, #9a3412)",
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => onQuickAction("cancel")}
                  className="px-4 py-2 text-xs font-semibold"
                  style={{
                    borderRadius: "999px",
                    background: "rgba(255,252,248,0.86)",
                    color: "#4a4a4a",
                    border: "1px solid rgba(154,52,18,0.12)",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            {msg.action.status === "committed" && typeof actionPayload?.invoice_id === "number" && (
              <div className="flex gap-2">
                <Link
                  href={`/invoice/${String(actionPayload.invoice_id)}`}
                  className="px-4 py-2 text-xs font-semibold text-white"
                  style={{
                    borderRadius: "999px",
                    background: "rgba(3,105,161,0.12)",
                    border: "1px solid rgba(3,105,161,0.18)",
                  }}
                >
                  Open Invoice
                </Link>
              </div>
            )}
          </div>
        )}

        <p
          className="mt-1 px-1 text-[10px]"
          style={{ color: "rgba(115,115,115,0.9)", textAlign: isUser ? "right" : "left" }}
        >
          {new Date(msg.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

export default function VoiceModal({ open, initialPrompt = null, onPromptConsumed, onClose }: Props) {
  const { shopId: storeShopId } = useShopStore();
  const {
    isListening,
    isProcessing,
    messages,
    error,
    sessionId,
    reset,
    clearSession,
  } = useVoiceStore();

  const resolvedShopId = useMemo(() => resolveShopId(storeShopId), [storeShopId]);
  const { startVoice, stopVoice, sendTextQuery, disconnect } = useVoiceCapture(resolvedShopId);

  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    "Show my low stock items.",
    "Restock 20 rice bags.",
    "Create invoice for Ramesh with 2 rice at 50 and 1 sugar at 40.",
  ];

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isProcessing, error]);

  useEffect(() => {
    if (!open || !initialPrompt || !resolvedShopId || isProcessing) return;
    void sendTextQuery(initialPrompt);
    onPromptConsumed?.();
  }, [open, initialPrompt, resolvedShopId, isProcessing, sendTextQuery, onPromptConsumed]);

  const handleClose = useCallback(() => {
    if (isListening) stopVoice();
    reset();
    onClose();
  }, [isListening, stopVoice, reset, onClose]);

  const handleEndSession = useCallback(() => {
    disconnect();
    clearSession();
    onClose();
  }, [disconnect, clearSession, onClose]);

  const handleSendText = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isProcessing || !resolvedShopId) return;
    setInputText("");
    await sendTextQuery(text);
  }, [inputText, isProcessing, resolvedShopId, sendTextQuery]);

  const handleQuickAction = useCallback((text: string) => {
    if (!resolvedShopId || isProcessing) return;
    void sendTextQuery(text);
  }, [resolvedShopId, isProcessing, sendTextQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  }, [handleSendText]);

  const handleMicToggle = useCallback(async () => {
    if (isListening) {
      stopVoice();
      return;
    }
    if (!resolvedShopId) return;
    await startVoice();
  }, [isListening, resolvedShopId, startVoice, stopVoice]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-end lg:p-6">
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(73, 52, 38, 0.26)",
          backdropFilter: "blur(10px)",
        }}
        onClick={handleClose}
      />

      <div
        className="relative flex w-full flex-col overflow-hidden lg:max-w-[460px]"
        style={{
          height: "min(100svh, 760px)",
          borderRadius: "28px 28px 0 0",
          background: "linear-gradient(180deg, rgba(253,252,249,0.98), rgba(248,246,242,0.98))",
          border: "1px solid rgba(154,52,18,0.12)",
          boxShadow: "0 30px 80px rgba(26,26,26,0.18), 0 0 0 1px rgba(255,255,255,0.4) inset",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at top left, rgba(194,65,12,0.12), transparent 34%),
              radial-gradient(circle at top right, rgba(3,105,161,0.12), transparent 32%),
              linear-gradient(rgba(154,52,18,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(154,52,18,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "auto, auto, 28px 28px, 28px 28px",
            backgroundPosition: "0 0, 100% 0, 0 0, 0 0",
            opacity: 0.55,
          }}
        />

        <div
          className="relative flex items-center justify-between px-5 py-5"
          style={{ borderBottom: "1px solid rgba(154,52,18,0.1)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center text-base font-black text-white"
              style={{
                borderRadius: "16px",
                background: "linear-gradient(135deg, #c2410c, #9a3412)",
                boxShadow: "0 14px 28px rgba(194,65,12,0.2)",
              }}
            >
              B
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: "#1a1a1a" }}>
                SmartDukaan
              </p>
              <p className="text-[11px] uppercase tracking-[0.28em]" style={{ color: "#737373" }}>
                {sessionId ? `Session #${sessionId}` : "Voice commerce assistant"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleEndSession}
                className="px-4 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{
                  borderRadius: "999px",
                  background: "rgba(255,252,248,0.88)",
                  color: "#4a4a4a",
                  border: "1px solid rgba(154,52,18,0.12)",
                }}
              >
                New Session
              </button>
            )}
            <button
              onClick={handleClose}
              className="flex h-10 w-10 items-center justify-center"
              style={{
                borderRadius: "14px",
                background: "rgba(255,252,248,0.88)",
                color: "#4a4a4a",
                border: "1px solid rgba(154,52,18,0.12)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-5 py-5">
          {messages.length === 0 && !isProcessing && (
            <div className="flex h-full flex-col justify-center">
              <div
                className="mb-6 max-w-sm"
                style={{
                  padding: "22px 22px 20px",
                  borderRadius: 26,
                  background: "rgba(255,252,248,0.9)",
                  border: "1px solid rgba(154,52,18,0.12)",
                  backdropFilter: "blur(18px)",
                }}
              >
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.35em]" style={{ color: "#c2410c" }}>
                  Ask in real time
                </p>
                <h3 className="mb-3 text-2xl font-bold leading-tight" style={{ color: "#1a1a1a" }}>
                  Voice-first answers with market and shop context.
                </h3>
                <p className="text-sm leading-6" style={{ color: "#4a4a4a" }}>
                  Speak in English, Hindi, or Telugu, or type your question. SmartDukaan will answer in English by default with live business context.
                </p>
              </div>

              <div className="grid gap-3">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInputText("");
                      void sendTextQuery(suggestion);
                    }}
                    disabled={!resolvedShopId}
                    className="w-full text-left transition-transform duration-200 hover:translate-x-1 disabled:opacity-50"
                    style={{
                      padding: "16px 18px",
                      borderRadius: 20,
                      background: "rgba(255,252,248,0.88)",
                      border: "1px solid rgba(154,52,18,0.12)",
                      color: "#1a1a1a",
                    }}
                  >
                    <span className="block text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: "#737373" }}>
                      Prompt
                    </span>
                    <span className="mt-1 block text-sm leading-6">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} onQuickAction={handleQuickAction} />
          ))}

          {error && (
            <div
              className="mx-1 mt-4 px-4 py-3 text-sm"
              style={{
                borderRadius: 18,
                background: "rgba(180,35,24,0.08)",
                border: "1px solid rgba(180,35,24,0.18)",
                color: "#7a1d14",
                backdropFilter: "blur(12px)",
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          className="relative px-4 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] pt-4"
          style={{
            borderTop: "1px solid rgba(154,52,18,0.1)",
            background: "linear-gradient(180deg, rgba(248,246,242,0.94), rgba(245,241,234,0.98))",
          }}
        >
          {isListening && (
            <div
              className="mb-3 flex items-center gap-2 px-3 py-2 text-xs font-semibold"
              style={{
                borderRadius: 16,
                background: "rgba(3,105,161,0.08)",
                border: "1px solid rgba(3,105,161,0.14)",
                color: "#0369a1",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#c2410c",
                  animation: "voice-pulse 1.2s ease-in-out infinite",
                }}
              />
              Recording now. Tap the mic again to send.
            </div>
          )}

          <div
            className="flex items-center gap-3 px-3 py-3"
            style={{
              borderRadius: 24,
              background: "rgba(255,252,248,0.88)",
              border: "1px solid rgba(154,52,18,0.12)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
            }}
          >
            <MicButton
              listening={isListening}
              disabled={!resolvedShopId || isProcessing}
              onClick={() => void handleMicToggle()}
            />

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={resolvedShopId ? (isListening ? "Speak your question..." : "Type your question...") : "Waiting for shop session..."}
              disabled={isListening || isProcessing || !resolvedShopId}
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]"
              style={{ color: "#1a1a1a" }}
            />

            <button
              onClick={handleSendText}
              disabled={!inputText.trim() || isProcessing || isListening || !resolvedShopId}
              className="flex h-11 w-11 items-center justify-center transition-all duration-200 disabled:opacity-40"
              style={{
                borderRadius: 16,
                background: "linear-gradient(135deg, #c2410c, #9a3412)",
                boxShadow: "0 10px 24px rgba(194,65,12,0.2)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes voice-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        @keyframes voice-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.45; }
          40% { transform: translateY(-4px); opacity: 1; }
        }

        @keyframes voice-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.35; }
        }

        @media (min-width: 1024px) {
          .voice-modal-panel {
            border-radius: 28px;
          }
        }
      `}</style>
    </div>
  );
}
