"use client";

import AlertCard from "./AlertCard";

interface Alert {
  id: number;
  product_name: string;
  level?: "HIGH" | "MEDIUM" | "LOW";
  severity?: "HIGH" | "MEDIUM" | "LOW";
  message?: string;
  reason?: string;
  created_at?: string;
}

interface Props {
  alerts: Alert[];
}

export default function AlertsPanel({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="empty-state">
        <p className="text-lg font-semibold text-[var(--color-text)]">No active alerts</p>
        <p className="mt-2 text-sm text-[var(--color-text-soft)]">Current inventory and sales patterns look stable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          productName={alert.product_name}
          severity={alert.severity || alert.level || "LOW"}
          message={alert.message || "No message available."}
          reason={alert.reason}
        />
      ))}
    </div>
  );
}
