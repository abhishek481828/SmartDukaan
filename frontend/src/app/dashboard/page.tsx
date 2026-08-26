"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareMore, RefreshCw } from "lucide-react";
import { AppShell, PageHeader, SectionHeader, StatCard } from "@/components/AppShell";
import ProductCard from "@/components/ProductCard";
import { getDashboard } from "../../lib/api";

type DashboardData = {
  user?: { name?: string };
  shop?: { shop_name?: string; city?: string };
  alerts?: Array<{
    id: number;
    product_name: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    message: string;
  }>;
  top_products?: Array<{
    id: number;
    name: string;
    today_qty: number;
    today_revenue: number;
    stock_qty: number;
    stock_status: "CRITICAL" | "LOW_STOCK" | "IN_STOCK";
    unit: string;
    trend_pct: number;
    mandi_price: number;
    risk_level: "HIGH" | "MEDIUM" | "LOW";
  }>;
  total_today?: { revenue?: number; items_sold?: number; profit_estimate?: number };
  stock_summary?: { low_stock_count?: number; inventory_value?: number };
};

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const topRevenueProduct = [...(dashboard?.top_products || [])].sort(
    (a, b) => (b.today_revenue || 0) - (a.today_revenue || 0),
  )[0] ?? null;

  function handleLogout() {
    localStorage.removeItem("bv_token");
    localStorage.removeItem("bv_user");
    localStorage.removeItem("bv_shop");
    localStorage.removeItem("bv_dashboard_refresh");
    sessionStorage.removeItem("bv_voice_session");
    router.replace("/login");
  }

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await getDashboard();
        setDashboard(data);
      } catch (err) {
        console.error("Failed to fetch dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();

    const refresh = () => void loadDashboard();
    const onStorage = (event: StorageEvent) => {
      if (event.key === "bv_dashboard_refresh") void loadDashboard();
    };
    const onManualRefresh = () => void loadDashboard();

    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    window.addEventListener("bv-dashboard-refresh", onManualRefresh);
    const interval = window.setInterval(refresh, 15000);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("bv-dashboard-refresh", onManualRefresh);
      window.clearInterval(interval);
    };
  }, []);

  const actions = (
    <>
      <button type="button" className="btn-secondary" onClick={() => window.dispatchEvent(new CustomEvent("bv-open-voice"))}>
        <MessageSquareMore size={16} />
        Ask SmartDukaan
      </button>
      <button type="button" className="btn-ghost" onClick={handleLogout}>
        Logout
      </button>
    </>
  );

  if (loading) {
    return (
      <AppShell>
        <div className="app-grid md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="metric-card h-40 animate-pulse" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (!dashboard) {
    return (
      <AppShell>
        <div className="empty-state">
          <p className="text-lg font-bold text-[var(--color-text)]">Unable to load dashboard</p>
          <p className="mt-2 text-sm text-[var(--color-text-soft)]">The data request failed. Refresh and try again.</p>
          <button type="button" className="btn-primary mt-5" onClick={() => window.location.reload()}>
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      </AppShell>
    );
  }

  const highOrMediumAlerts = dashboard.alerts?.filter((alert) => alert.severity !== "LOW") || [];
  const sortedProducts = [...(dashboard.top_products || [])].sort(
    (a, b) => (b.today_revenue || 0) - (a.today_revenue || 0),
  );
  const topFocusCount = sortedProducts.length > 0 ? Math.max(1, Math.ceil(sortedProducts.length * 0.2)) : 0;
  const topFocusProducts = sortedProducts.slice(0, topFocusCount);
  const totalRevenue = sortedProducts.reduce((sum, product) => sum + (product.today_revenue || 0), 0);
  const topFocusRevenue = topFocusProducts.reduce((sum, product) => sum + (product.today_revenue || 0), 0);
  const topFocusShare = totalRevenue > 0 ? Math.round((topFocusRevenue / totalRevenue) * 100) : 0;
  const revenueValue = `Rs.${(dashboard.total_today?.revenue || 0).toLocaleString("en-IN")}`;
  const profitValue = `Rs.${(dashboard.total_today?.profit_estimate || 0).toLocaleString("en-IN")}`;
  const inventoryValue = `Rs.${(dashboard.stock_summary?.inventory_value || 0).toLocaleString("en-IN")}`;
  return (
    <AppShell topbar={<span className="status-badge status-info">{dashboard.shop?.shop_name || "Retail workspace"}</span>}>
      <section className="glass-card mb-8 overflow-hidden p-6 md:p-8">
        <PageHeader
          eyebrow="Daily overview"
          title={`Good morning, ${dashboard.user?.name || "Ramesh"}`}
          description={`${dashboard.shop?.shop_name || "Your store"} in ${dashboard.shop?.city || "Nagpur"} with live revenue, stock, and risk context.`}
          actions={actions}
        />

        <div className="app-grid md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Revenue today" value={revenueValue} hint="Gross revenue recorded across current activity." />
          <StatCard label="Items sold" value={`${dashboard.total_today?.items_sold || 0}`} hint="Units sold today from sales and invoice entries." tone="accent" />
          <StatCard label="Estimated profit" value={profitValue} hint="Derived from current selling and cost prices." tone="success" />
          <StatCard label="Inventory value" value={inventoryValue} hint={`${dashboard.stock_summary?.low_stock_count || 0} low stock SKU flagged.`} tone="warning" />
        </div>

        <div className="mt-5 grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
          <div className="surface-strong p-5">
            <p className="eyebrow">Priority focus</p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.05em] text-[var(--color-text)]">
              {topRevenueProduct ? topRevenueProduct.name : "No top product yet"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-text-soft)]">
              {topRevenueProduct
                ? `Leading today's revenue with Rs.${topRevenueProduct.today_revenue.toLocaleString("en-IN")} from ${topRevenueProduct.today_qty} ${topRevenueProduct.unit}.`
                : "Once sales activity starts, SmartDukaan will highlight the product driving the day's income."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="status-badge status-warning">{highOrMediumAlerts.length} active risks</span>
              {topRevenueProduct ? (
                <span className="status-badge status-success">{topRevenueProduct.risk_level.toLowerCase()} current risk</span>
              ) : null}
            </div>
          </div>

          <div className="surface p-5">
            <p className="eyebrow">Operator summary</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="surface-muted px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Store</p>
                <p className="mt-2 text-base font-bold text-[var(--color-text)]">{dashboard.shop?.shop_name || "Retail workspace"}</p>
              </div>
              <div className="surface-muted px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">City</p>
                <p className="mt-2 text-base font-bold text-[var(--color-text)]">{dashboard.shop?.city || "Nagpur"}</p>
              </div>
              <div className="surface-muted px-4 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Alert load</p>
                <p className="mt-2 text-base font-bold text-[var(--color-text)]">{highOrMediumAlerts.length} open</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Product performance"
          description="Top products ordered by today's revenue with mandi and stock context."
        />
        <div className="surface-muted mb-5 px-5 py-4 md:px-6">
          <p className="eyebrow">80 / 20 focus</p>
          <p className="mt-2 text-base font-bold text-[var(--color-text)] md:text-lg">
            {topFocusCount > 0
              ? `${topFocusCount} of ${sortedProducts.length} products are driving about ${topFocusShare}% of today's revenue.`
              : "SmartDukaan will highlight the few products driving most of your income as sales come in."}
          </p>
          <p className="mt-2 text-sm leading-7 text-[var(--color-text-soft)]">
            {topFocusProducts.length > 0
              ? `Focus extra stock, pricing, and daily checks on ${topFocusProducts.map((product) => product.name).join(", ")}. In most shops, a small set of products drives most of the money.`
              : "Once revenue starts moving, this panel will show which small set of products deserves the most attention."}
          </p>
        </div>
        <div className="app-grid md:grid-cols-2 2xl:grid-cols-3">
          {dashboard.top_products?.map((product) => (
            <ProductCard
              key={product.id}
              name={product.name}
              todayQty={product.today_qty}
              todayRevenue={product.today_revenue}
              stockQty={product.stock_qty}
              stockStatus={product.stock_status}
              unit={product.unit}
              trendPct={product.trend_pct}
              mandiPrice={product.mandi_price}
              riskLevel={product.risk_level}
            />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
