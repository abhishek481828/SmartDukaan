"use client";

import { AlertCircle, AlertTriangle, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/cn";

interface AlertCardProps {
  productName: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  reason?: string;
  onAskSmartDukaan?: () => void;
}

export default function AlertCard({
  productName,
  severity,
  message,
  reason,
  onAskSmartDukaan,
}: AlertCardProps) {
  const isHigh = severity === "HIGH";
  const isMedium = severity === "MEDIUM";

  const Icon = isHigh ? AlertCircle : isMedium ? AlertTriangle : Info;
  const badgeClass = severity === "HIGH" ? "status-danger" : severity === "MEDIUM" ? "status-warning" : "status-info";
  const iconTone = severity === "HIGH" ? "text-[var(--color-danger)]" : severity === "MEDIUM" ? "text-[var(--color-warning)]" : "text-[var(--color-info)]";

  const handleAsk = () => {
    if (onAskSmartDukaan) {
      onAskSmartDukaan();
      return;
    }

    window.dispatchEvent(
      new CustomEvent("bv-open-voice", {
        detail: {
          prompt: `Explain this business risk and what I should do now. Product: ${productName}. Severity: ${severity}. Alert: ${message}. Reason: ${reason ?? "No extra reason available."}`,
        },
      }),
    );
  };

  return (
    <article className="surface flex flex-col gap-4 p-5 transition-transform duration-200 hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-[20px] bg-[var(--color-panel-muted)] p-3">
            <Icon className={iconTone} size={20} strokeWidth={2.4} />
          </div>
          <div>
            <p className="metric-label">Risk alert</p>
            <h4 className="mt-1 text-xl font-extrabold tracking-[-0.03em] text-[var(--color-text)]">{productName}</h4>
          </div>
        </div>
        <span className={cn("status-badge", badgeClass)}>
          {severity}
        </span>
      </div>

      <p className="text-sm leading-7 text-[var(--color-text)]">{message}</p>

      {reason && (
        <p className="rounded-[22px] bg-[rgba(26,26,26,0.04)] px-4 py-3 text-sm leading-7 text-[var(--color-text-soft)]">
          {reason}
        </p>
      )}

      <div className="mt-1">
        <button
          type="button"
          onClick={handleAsk}
          className="btn-secondary"
        >
          Ask SmartDukaan
          <ChevronRight size={14} />
        </button>
      </div>
    </article>
  );
}
