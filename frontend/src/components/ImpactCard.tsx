"use client";

import { useState } from "react";
import { simulate } from "@/lib/api";

export default function ImpactCard() {
  const [currentPrice, setCurrentPrice] = useState(45);
  const [suggestedPrice, setSuggestedPrice] = useState(42);
  const [result, setResult] = useState<Record<string, number | string> | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const res = await simulate({
        shop_id: 1,
        product_id: 1,
        action: "price_cut",
        current_price: currentPrice,
        suggested_price: suggestedPrice,
        avg_daily_qty: 30,
      });
      setResult(res as Record<string, number | string>);
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface p-6">
      <p className="eyebrow">Profit simulator</p>
      <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">Test a price change before committing.</h3>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div>
          <label className="eyebrow">Current price</label>
          <input type="number" value={currentPrice} onChange={(e) => setCurrentPrice(Number(e.target.value))} className="field mt-2" />
        </div>
        <div>
          <label className="eyebrow">Suggested price</label>
          <input type="number" value={suggestedPrice} onChange={(e) => setSuggestedPrice(Number(e.target.value))} className="field mt-2" />
        </div>
      </div>

      <button onClick={handleSimulate} disabled={loading} className="btn-primary mt-5 w-full disabled:opacity-60">
        {loading ? "Simulating..." : "Simulate impact"}
      </button>

      {result ? (
        <div className="surface-muted mt-5 p-4">
          <p className="eyebrow">Projected profit delta</p>
          <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-[var(--color-success)]">
            Rs.{Number(result.delta || 0).toLocaleString("en-IN")}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">{String(result.summary || "")}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-4 text-sm">
            <div>
              <p className="eyebrow">Current</p>
              <p className="mt-1 font-medium text-[var(--color-text)]">Rs.{Number(result.current_profit || 0).toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="eyebrow">Projected</p>
              <p className="mt-1 font-medium text-[var(--color-success)]">Rs.{Number(result.projected_profit || 0).toLocaleString("en-IN")}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
