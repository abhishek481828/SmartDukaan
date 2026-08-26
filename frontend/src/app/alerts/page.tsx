"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Radar, RefreshCw } from "lucide-react";
import { AppShell, PageHeader, SectionHeader } from "@/components/AppShell";
import AlertCard from "@/components/AlertCard";
import { getAlerts, runAlertsJob, type RiskAlert } from "@/lib/api";
import { cn } from "@/lib/cn";

type Severity = "ALL" | "HIGH" | "MEDIUM" | "LOW";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [filter, setFilter] = useState<Severity>("ALL");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const loadCurrentAlerts = useCallback(async () => {
    try {
      const data = await getAlerts();
      setAlerts(data);
      setError("");
    } catch (err) {
      console.error("Failed to load alerts:", err);
      setError("Could not load current risk alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCurrentAlerts();
    const interval = window.setInterval(() => void loadCurrentAlerts(), 60000);
    return () => window.clearInterval(interval);
  }, [loadCurrentAlerts]);

  const filteredAlerts = useMemo(
    () => (filter === "ALL" ? alerts : alerts.filter((alert) => alert.severity === filter)),
    [alerts, filter],
  );

  const severityCount = (severity: Severity) =>
    severity === "ALL" ? alerts.length : alerts.filter((alert) => alert.severity === severity).length;

  const handleManualRun = async () => {
    setRunning(true);
    try {
      await runAlertsJob();
      await loadCurrentAlerts();
      localStorage.setItem("bv_dashboard_refresh", String(Date.now()));
      window.dispatchEvent(new CustomEvent("bv-dashboard-refresh"));
      setError("");
    } catch (err) {
      console.error("Failed to run alert job:", err);
      setError("Could not run the alert scan right now.");
    } finally {
      setRunning(false);
    }
  };

  const actions = (
    <button type="button" onClick={handleManualRun} disabled={running} className="btn-primary disabled:opacity-60">
      <RefreshCw size={16} className={cn(running && "animate-spin")} />
      {running ? "Scanning..." : "Run Job Now"}
    </button>
  );

  return (
    <AppShell topbar={<span className="status-badge status-warning">{alerts.length} active alerts</span>}>
      <PageHeader
        eyebrow="Risk monitoring"
        title="Alerts"
        description="Fresh demand, stock, and market risk signals surfaced for immediate action."
        actions={actions}
      />

      <section className="surface mb-8 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["ALL", "HIGH", "MEDIUM", "LOW"] as Severity[]).map((severity) => (
              <button
                key={severity}
                type="button"
                onClick={() => setFilter(severity)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  filter === severity
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[rgba(15,23,42,0.05)] text-[var(--color-text-soft)] hover:bg-[rgba(15,23,42,0.08)] hover:text-[var(--color-text)]",
                )}
              >
                {severity} · {severityCount(severity)}
              </button>
            ))}
          </div>
          <p className="text-sm text-[var(--color-text-soft)]">Background scans run every 30 minutes.</p>
        </div>
      </section>

      {error ? <div className="surface mb-6 border-[rgba(198,92,77,0.22)] p-4 text-sm text-[var(--color-danger)]">{error}</div> : null}

      {running ? (
        <div className="surface mb-8 flex items-center justify-between gap-4 p-5">
          <div>
            <p className="eyebrow">Live scan</p>
            <p className="text-sm text-[var(--color-text-soft)]">Reviewing inventory pressure, forecast anomalies, and fresh market context.</p>
          </div>
          <Radar className="text-[var(--color-accent)]" size={24} />
        </div>
      ) : null}

      <SectionHeader
        title="Current alert list"
        description="Filter by severity and open any alert in the voice assistant for explanation and next steps."
      />

      {loading ? (
        <div className="app-grid md:grid-cols-2">
          {[1, 2, 3, 4].map((card) => (
            <div key={card} className="surface h-44 animate-pulse" />
          ))}
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="empty-state">
          <p className="text-lg font-semibold text-[var(--color-text)]">No active alerts right now</p>
          <p className="mt-2 text-sm text-[var(--color-text-soft)]">Nothing currently requires intervention.</p>
        </div>
      ) : (
        <div className="app-grid md:grid-cols-2">
          {filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              productName={alert.product_name}
              severity={alert.severity}
              message={alert.message}
              reason={alert.reason}
              onAskSmartDukaan={() =>
                window.dispatchEvent(
                  new CustomEvent("bv-open-voice", {
                    detail: {
                      prompt: `Explain this business risk and what I should do now. Product: ${alert.product_name}. Severity: ${alert.severity}. Alert: ${alert.message}. Reason: ${alert.reason ?? "No extra reason available."}`,
                    },
                  }),
                )
              }
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

