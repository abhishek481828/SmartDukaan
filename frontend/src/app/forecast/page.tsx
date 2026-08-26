"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell, PageHeader, SectionHeader, StatCard } from "@/components/AppShell";
import ForecastChart from "@/components/ForecastChart";
import ImpactCard from "@/components/ImpactCard";
import { getForecast, getInventory, type InventoryItem } from "@/lib/api";
import { SEED_FORECASTS, type ProductForecast } from "@/lib/forecastSeedData";
import { cn } from "@/lib/cn";

function buildForecastFromApi(product: InventoryItem, apiData: Record<string, unknown>): ProductForecast | null {
  if (!Array.isArray(apiData.forecast_7d) || apiData.forecast_7d.length === 0) return null;

  const points = (apiData.forecast_7d as Array<Record<string, unknown>>).map((point) => ({
    date: String(point.date ?? ""),
    forecast: Number(point.predicted_qty ?? 0),
    lower_bound: Number(point.lower_bound ?? 0),
    upper_bound: Number(point.upper_bound ?? 0),
  }));

  const expectedDemand = points.reduce((sum, point) => sum + (point.forecast ?? 0), 0) / Math.max(points.length, 1);
  const firstQty = points[0]?.forecast ?? expectedDemand;
  const lastQty = points[points.length - 1]?.forecast ?? expectedDemand;
  const trend7dPct = firstQty ? ((lastQty - firstQty) / firstQty) * 100 : 0;
  const boundedPoints = points.filter((point) => (point.forecast ?? 0) > 0);
  const avgBandRatio =
    boundedPoints.length > 0
      ? boundedPoints.reduce((sum, point) => {
          const width = (point.upper_bound ?? 0) - (point.lower_bound ?? 0);
          return sum + width / Math.max(point.forecast ?? 1, 1);
        }, 0) / boundedPoints.length
      : 0.3;
  const confidencePct = Math.max(55, Math.min(96, Math.round(100 - avgBandRatio * 35)));
  const isAnomaly = Boolean(apiData.is_anomaly);
  const anomalyPct = Number(apiData.anomaly_pct ?? 0);

  return {
    product_name: String(apiData.product_name ?? product.name),
    expected_demand: Math.round(expectedDemand * 10) / 10,
    trend_7d_pct: Math.round(trend7dPct * 10) / 10,
    confidence_pct: confidencePct,
    market_label: isAnomaly ? "Demand risk detected" : trend7dPct >= 8 ? "Rising demand" : trend7dPct <= -8 ? "Soft demand" : "Stable market",
    is_anomaly: isAnomaly,
    anomaly_pct: anomalyPct,
    forecast_7d: points,
  };
}

export default function ForecastPage() {
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [forecast, setForecast] = useState<ProductForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [usingSeeded, setUsingSeeded] = useState(false);

  const selectedProduct = products.find((product) => product.id === selectedId) ?? null;

  const loadForecast = useCallback(async (product: InventoryItem) => {
    setLoading(true);
    setUsingSeeded(false);
    try {
      const apiData = (await getForecast(product.id)) as Record<string, unknown>;
      const normalized = buildForecastFromApi(product, apiData);
      if (!normalized) throw new Error("Incomplete API response");
      setForecast(normalized);
    } catch {
      const seed = SEED_FORECASTS[product.name];
      if (seed) {
        setForecast(seed);
        setUsingSeeded(true);
      } else {
        setForecast(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadProducts() {
      setInventoryLoading(true);
      try {
        const inventory = await getInventory();
        setProducts(inventory);
        setSelectedId((current) => current ?? inventory[0]?.id ?? null);
      } catch (error) {
        console.error("Failed to fetch inventory for forecast:", error);
        setProducts([]);
        setSelectedId(null);
      } finally {
        setInventoryLoading(false);
      }
    }

    void loadProducts();
  }, []);

  useEffect(() => {
    if (!selectedProduct) {
      setForecast(null);
      setLoading(false);
      return;
    }
    void loadForecast(selectedProduct);
  }, [selectedProduct, loadForecast]);

  return (
    <AppShell topbar={usingSeeded ? <span className="status-badge status-warning">Seeded fallback</span> : null}>
      <PageHeader
        eyebrow="Forecasting"
        title="Demand forecast"
        description="Review expected demand, confidence, and anomaly signals product by product without interrupting daily operations."
      />

      {inventoryLoading ? (
        <div className="surface px-6 py-12 text-sm text-[var(--color-text-soft)]">Loading inventory products...</div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <p className="text-lg font-semibold text-[var(--color-text)]">No inventory products available</p>
          <p className="mt-2 text-sm text-[var(--color-text-soft)]">Add inventory first to unlock forecasting views.</p>
        </div>
      ) : (
        <>
          <section className="mb-8 flex flex-wrap gap-2">
            {products.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedId(product.id)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  selectedId === product.id
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[rgba(15,23,42,0.05)] text-[var(--color-text-soft)] hover:bg-[rgba(15,23,42,0.08)] hover:text-[var(--color-text)]",
                )}
              >
                {product.name}
              </button>
            ))}
          </section>

          {loading ? (
            <div className="app-grid lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="app-grid md:grid-cols-3">
                {[1, 2, 3].map((card) => (
                  <div key={card} className="metric-card h-40 animate-pulse" />
                ))}
                <div className="surface col-span-full h-[420px] animate-pulse" />
              </div>
              <div className="surface h-[420px] animate-pulse" />
            </div>
          ) : forecast ? (
            <>
              {usingSeeded ? (
                <div className="surface mb-6 border-[rgba(180,123,39,0.18)] p-4 text-sm text-[var(--color-warning)]">
                  Showing seeded fallback data for this inventory product because live forecast rows are not ready yet.
                </div>
              ) : null}

              <section className="app-grid md:grid-cols-3">
                <StatCard label="Expected demand" value={`${forecast.expected_demand} ${selectedProduct?.unit ?? "unit"}/day`} hint={forecast.market_label} />
                <StatCard label="Trend (7d)" value={`${forecast.trend_7d_pct >= 0 ? "+" : ""}${forecast.trend_7d_pct.toFixed(1)}%`} hint="Change in forecast direction over the next week." tone={forecast.trend_7d_pct >= 0 ? "success" : "warning"} />
                <StatCard label="Confidence" value={`${forecast.confidence_pct}%`} hint={forecast.confidence_pct >= 85 ? "Strong confidence for current trend." : "Confidence improves with more real data."} tone="accent" />
              </section>

              <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div>
                  <SectionHeader title="Trajectory" description="Use the confidence band to judge how aggressive pricing or buying decisions should be." />
                  <ForecastChart data={forecast.forecast_7d} productName={forecast.product_name} />
                  {forecast.is_anomaly ? (
                    <div className="surface mt-5 border-[rgba(198,92,77,0.22)] p-4 text-sm text-[var(--color-danger)]">
                      Current pattern deviates by {forecast.anomaly_pct.toFixed(1)}% from expected demand.
                    </div>
                  ) : null}
                </div>
                <div className="space-y-6">
                  <ImpactCard />
                  <div className="surface p-5">
                    <p className="eyebrow">Projected change</p>
                    <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-[var(--color-success)]">
                      +Rs.{(forecast.expected_demand * 6.8).toFixed(0)}
                    </p>
                    <p className="mt-3 text-sm text-[var(--color-text-soft)]">Estimated opportunity over the next seven days if inventory and pricing stay aligned.</p>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className="empty-state">
              <p className="text-lg font-semibold text-[var(--color-text)]">No forecast data available</p>
              <p className="mt-2 text-sm text-[var(--color-text-soft)]">This product does not have enough forecast rows yet.</p>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

