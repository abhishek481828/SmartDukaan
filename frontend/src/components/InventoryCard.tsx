"use client";

import { AlertOctagon, Package, RefreshCw, TrendingDown } from "lucide-react";
import type { InventoryItem } from "@/lib/api";
import { cn } from "@/lib/cn";

export default function InventoryCard({
  item,
  onUpdate,
}: {
  item: InventoryItem;
  onUpdate: (item: InventoryItem) => void;
}) {
  const isCritical = item.status === "CRITICAL";
  const isLow = item.status === "LOW_STOCK";
  const statusClass = isCritical ? "status-danger" : isLow ? "status-warning" : "status-success";

  return (
    <article className="surface flex flex-col justify-between p-5 transition-transform duration-200 hover:-translate-y-1">
      <div>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <span className="status-badge status-info">
              {item.category}
            </span>
            <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">{item.name}</h3>
          </div>
          <div className="rounded-2xl bg-[var(--color-panel-muted)] p-2.5">
            {isCritical ? (
              <AlertOctagon className="text-[var(--color-danger)]" size={22} />
            ) : isLow ? (
              <TrendingDown className="text-[var(--color-warning)]" size={22} />
            ) : (
              <Package className="text-[var(--color-success)]" size={22} />
            )}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="surface-muted px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">In stock</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
              {item.in_stock} <span className="text-sm font-medium text-[var(--color-text-soft)]">{item.unit}</span>
            </p>
          </div>
          <div className="surface-muted px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Minimum</p>
            <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
              {item.minimum_required} <span className="text-sm font-medium text-[var(--color-text-soft)]">{item.unit}</span>
            </p>
          </div>
        </div>

        <div className="text-sm text-[var(--color-text-soft)]">
          Avg daily demand: {item.avg_daily_qty} {item.unit}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        <span className={cn("status-badge", statusClass)}>
          {isCritical || isLow ? "Restock needed" : "Healthy stock"}
        </span>

        <button onClick={() => onUpdate(item)} className="btn-secondary px-4 py-2 text-xs">
          <RefreshCw size={14} /> Update
        </button>
      </div>
    </article>
  );
}
