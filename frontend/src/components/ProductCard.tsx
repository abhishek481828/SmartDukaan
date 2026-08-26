import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";

interface ProductCardProps {
  name: string;
  todayQty: number;
  todayRevenue: number;
  stockQty: number;
  stockStatus: "CRITICAL" | "LOW_STOCK" | "IN_STOCK";
  unit: string;
  trendPct: number;
  mandiPrice: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
}

export default function ProductCard({
  name,
  todayQty,
  todayRevenue,
  stockQty,
  stockStatus,
  unit,
  trendPct,
  mandiPrice,
  riskLevel,
}: ProductCardProps) {
  const isPositive = trendPct > 0;
  const isNeutral = trendPct === 0;
  const riskTone = riskLevel === "HIGH" ? "status-danger" : riskLevel === "MEDIUM" ? "status-warning" : "status-success";
  const stockTone = stockStatus === "CRITICAL" ? "text-[var(--color-danger)]" : stockStatus === "LOW_STOCK" ? "text-[var(--color-warning)]" : "text-[var(--color-success)]";

  return (
    <article className="surface group flex min-w-0 flex-col justify-between p-5 transition-transform duration-200 hover:-translate-y-1">
      <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="metric-label">Product</p>
          <h3 className="mt-1 break-words text-2xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">{name}</h3>
        </div>
        <span className={cn("status-badge", riskTone)}>{riskLevel} risk</span>
      </div>

      <div className="min-w-0">
        <p className="metric-label">Today&apos;s revenue</p>
        <p className="mt-2 overflow-hidden text-[clamp(2.1rem,3vw,3.4rem)] font-extrabold leading-none tracking-[-0.06em] text-[var(--color-text)]">
          Rs.{todayRevenue.toLocaleString("en-IN")}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="surface-muted px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Sold</p>
            <p className="mt-1 font-bold text-[var(--color-text)]">
              {todayQty} {unit}
            </p>
          </div>
          <div className="surface-muted px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Mandi</p>
            <p className="mt-1 font-bold text-[var(--color-text)]">Rs.{mandiPrice}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-[var(--color-border)] pt-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Stock status</p>
          <p className={cn("mt-1 text-sm font-bold", stockTone)}>
            {stockQty} {unit} - {stockStatus.replace("_", " ").toLowerCase()}
          </p>
        </div>
        <div
          className={cn(
            "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold",
            isPositive
              ? "bg-[rgba(21,128,61,0.12)] text-[var(--color-success)]"
              : isNeutral
                ? "bg-[rgba(26,26,26,0.06)] text-[var(--color-text-soft)]"
                : "bg-[rgba(180,35,24,0.12)] text-[var(--color-danger)]",
          )}
        >
          {isPositive ? <TrendingUp size={14} className="mr-1.5" /> : isNeutral ? <Minus size={14} className="mr-1.5" /> : <TrendingDown size={14} className="mr-1.5" />}
          {Math.abs(trendPct)}% vs 7d
        </div>
      </div>
    </article>
  );
}
