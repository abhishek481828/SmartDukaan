"use client";

import { useEffect, useRef } from "react";
import { useShopStore } from "@/store/useShopStore";

const WS_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws") ?? "ws://localhost:8000";

export function useDashboardSocket(shopId: number | null) {
  const { addAlert, setProducts } = useShopStore();

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const maxRetries = 5;
  const timerId = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!shopId) return;

    function connect() {
      const ws = new WebSocket(`${WS_BASE}/ws/dashboard/${shopId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as { type: string; payload?: unknown };

          switch (data.type) {
            case "alert": {
              const alert = data.payload as {
                id: number;
                product_id?: number;
                product_name: string;
                severity: "HIGH" | "MEDIUM" | "LOW";
                message: string;
                reason?: string;
                created_at?: string;
              };
              addAlert({ ...alert, created_at: alert.created_at ?? new Date().toISOString() });
              break;
            }

            case "forecast_ready": {
              import("@/lib/api").then(({ getDashboard }) =>
                getDashboard()
                  .then((d) => {
                    const payload = d as { products?: unknown[] };
                    if (Array.isArray(payload.products)) {
                      setProducts(payload.products as Parameters<typeof setProducts>[0]);
                    }
                  })
                  .catch(console.error),
              );
              break;
            }

            default:
              break;
          }
        } catch {
          // Ignore non-JSON frames.
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (retryRef.current < maxRetries) {
          const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
          retryRef.current += 1;
          timerId.current = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      if (timerId.current) clearTimeout(timerId.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [shopId, addAlert, setProducts]);
}
