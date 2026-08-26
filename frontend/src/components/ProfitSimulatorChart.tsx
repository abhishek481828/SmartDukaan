"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface SimulationResult {
  currentProfit:   number;
  projectedProfit: number;
  delta:           number;
  pctChange:       number;
  summary:         string;
}

interface Props {
  result: SimulationResult | null;
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 text-sm"
      style={{
        borderRadius: "var(--radius-sm)",
        background: "var(--color-surface-0)",
        boxShadow: "var(--shadow-clay)",
        border: "1px solid rgba(255,255,255,0.5)",
        color: "var(--color-text-strong)",
      }}
    >
      <p className="font-bold">₹{payload[0].value.toLocaleString("en-IN")}</p>
      <p style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>{payload[0].name}</p>
    </div>
  );
};

export default function ProfitSimulatorChart({ result, isLoading }: Props) {
  if (isLoading) {
    return (
      <div
        className="clay-card p-5 flex items-center justify-center"
        style={{ height: 200 }}
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: "var(--color-primary-400)",
                animation: `bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div
        className="clay-card p-5 text-center"
        style={{ color: "var(--color-text-soft)" }}
      >
        <p className="text-2xl mb-2">📊</p>
        <p className="text-sm font-semibold">Simulate Impact</p>
        <p className="text-xs mt-1">SmartDukaan ke recommendation ke baad yahan click karein</p>
      </div>
    );
  }

  const data = [
    { name: "Current", value: result.currentProfit },
    { name: "Projected", value: result.projectedProfit },
  ];

  const isPositive = result.delta >= 0;

  return (
    <div className="clay-card p-5 space-y-4">
      {/* Summary headline */}
      <div>
        <p
          className="text-2xl font-black tabular-nums"
          style={{
            color: isPositive ? "var(--color-success)" : "var(--color-error)",
            fontFamily: "var(--font-syne)",
          }}
        >
          {isPositive ? "+" : ""}₹{Math.abs(result.delta).toLocaleString("en-IN")}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
          {result.pctChange > 0 ? "+" : ""}{result.pctChange.toFixed(1)}% profit change
        </p>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barCategoryGap="40%">
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((_, index) => (
              <Cell
                key={index}
                fill={
                  index === 0
                    ? "var(--color-surface-3)"
                    : isPositive
                    ? "var(--color-success)"
                    : "var(--color-error)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary text */}
      <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        {result.summary}
      </p>
    </div>
  );
}
