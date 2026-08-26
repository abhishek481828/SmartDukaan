"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastPoint } from "@/lib/forecastSeedData";

interface Props {
  data: ForecastPoint[];
  productName?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; dataKey?: string; name?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[rgba(255,251,245,0.98)] px-4 py-3 text-xs shadow-[var(--shadow-md)]">
      <p className="mb-2 font-semibold text-[var(--color-text)]">
        {label
          ? new Date(label).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : ""}
      </p>
      {payload.map((point, index) => {
        if (point.dataKey === "lower_bound" || point.dataKey === "upper_bound") return null;
        return (
          <p key={index} className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: point.color }} />
            <span className="text-[var(--color-text-soft)]">{point.name}:</span>
            <span className="font-semibold text-[var(--color-text)]">{point.value} kg</span>
          </p>
        );
      })}
    </div>
  );
}

export default function ForecastChart({ data, productName = "Product" }: Props) {
  if (!data.length) {
    return <div className="surface flex h-[300px] items-center justify-center text-sm text-[var(--color-text-soft)]">No forecast data available</div>;
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="surface p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-text)]">Demand trajectory</h3>
          <p className="mt-1 text-sm text-[var(--color-text-soft)]">Actual trend, forecast path, and confidence band.</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--color-text-soft)]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[#5b7aa6]" />
            Actual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            Forecast
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
          <defs>
            <linearGradient id="actualGradFc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#5b7aa6" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#5b7aa6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="forecastGradFc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0f766e" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="bandGradFc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0f766e" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "rgba(102,88,74,0.82)" }}
            tickFormatter={(value) =>
              new Date(value).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })
            }
            interval={2}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "rgba(102,88,74,0.82)" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            x={todayStr}
            stroke="rgba(91,122,166,0.56)"
            strokeDasharray="4 4"
            label={{ value: "Today", fill: "rgba(91,122,166,0.8)", fontSize: 10, fontWeight: 700 }}
          />
          <Area type="monotone" dataKey="upper_bound" stroke="none" fill="url(#bandGradFc)" fillOpacity={1} dot={false} activeDot={false} />
          <Area type="monotone" dataKey="lower_bound" stroke="none" fill="#f6f1e8" fillOpacity={0.78} dot={false} activeDot={false} />
          <Area
            type="monotone"
            dataKey="actual"
            name="Actual"
            stroke="#5b7aa6"
            strokeWidth={2.5}
            fill="url(#actualGradFc)"
            dot={{ r: 3, fill: "#5b7aa6", stroke: "#f6f1e8", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "#5b7aa6", stroke: "#fff", strokeWidth: 2 }}
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#0f766e"
            strokeWidth={2.5}
            strokeDasharray="6 4"
            fill="url(#forecastGradFc)"
            dot={{ r: 3, fill: "#0f766e", stroke: "#f3f0ea", strokeWidth: 2 }}
            activeDot={{ r: 5, fill: "#0f766e", stroke: "#fff", strokeWidth: 2 }}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      <p className="mt-3 text-center text-xs text-[var(--color-text-soft)]">{productName} · 14-day history + 7-day AI prediction</p>
    </div>
  );
}

