// ============================================================
// Deterministic Seed Data for Demand Forecasting
// NO random data — every value is hand-authored to mimic
// realistic kirana-store sales patterns for 5 staple products.
// ============================================================

export interface ForecastPoint {
  date: string;
  actual?: number;
  forecast?: number;
  lower_bound?: number;
  upper_bound?: number;
}

export interface ProductForecast {
  product_name: string;
  expected_demand: number;      // avg daily kg
  trend_7d_pct: number;         // e.g. -5.2
  confidence_pct: number;       // e.g. 94
  market_label: string;         // "Stable Market", "Rising Demand", etc.
  is_anomaly: boolean;
  anomaly_pct: number;
  forecast_7d: ForecastPoint[];
}

/** Helper: given a base date offset by `daysAgo`, return YYYY-MM-DD */
function dateStr(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().split("T")[0];
}

// ────────────────────────────────────────────────────────────
// Hand-crafted 14-day history + 7-day forecast per product
// Days -13…0 are actuals; days +1…+7 are forecast with bands
// ────────────────────────────────────────────────────────────

const RICE_DATA: ForecastPoint[] = [
  { date: dateStr(-13), actual: 28 },
  { date: dateStr(-12), actual: 32 },
  { date: dateStr(-11), actual: 30 },
  { date: dateStr(-10), actual: 27 },
  { date: dateStr(-9),  actual: 35 },
  { date: dateStr(-8),  actual: 33 },
  { date: dateStr(-7),  actual: 29 },
  { date: dateStr(-6),  actual: 31 },
  { date: dateStr(-5),  actual: 28 },
  { date: dateStr(-4),  actual: 30 },
  { date: dateStr(-3),  actual: 26 },
  { date: dateStr(-2),  actual: 32 },
  { date: dateStr(-1),  actual: 29 },
  { date: dateStr(0),   actual: 30 },
  { date: dateStr(1),   forecast: 31, lower_bound: 27, upper_bound: 35 },
  { date: dateStr(2),   forecast: 29, lower_bound: 25, upper_bound: 33 },
  { date: dateStr(3),   forecast: 30, lower_bound: 26, upper_bound: 34 },
  { date: dateStr(4),   forecast: 32, lower_bound: 28, upper_bound: 36 },
  { date: dateStr(5),   forecast: 28, lower_bound: 24, upper_bound: 32 },
  { date: dateStr(6),   forecast: 31, lower_bound: 27, upper_bound: 35 },
  { date: dateStr(7),   forecast: 30, lower_bound: 26, upper_bound: 34 },
];

const DAL_DATA: ForecastPoint[] = [
  { date: dateStr(-13), actual: 18 },
  { date: dateStr(-12), actual: 20 },
  { date: dateStr(-11), actual: 22 },
  { date: dateStr(-10), actual: 19 },
  { date: dateStr(-9),  actual: 21 },
  { date: dateStr(-8),  actual: 24 },
  { date: dateStr(-7),  actual: 23 },
  { date: dateStr(-6),  actual: 25 },
  { date: dateStr(-5),  actual: 22 },
  { date: dateStr(-4),  actual: 26 },
  { date: dateStr(-3),  actual: 24 },
  { date: dateStr(-2),  actual: 27 },
  { date: dateStr(-1),  actual: 25 },
  { date: dateStr(0),   actual: 26 },
  { date: dateStr(1),   forecast: 27, lower_bound: 23, upper_bound: 31 },
  { date: dateStr(2),   forecast: 28, lower_bound: 24, upper_bound: 32 },
  { date: dateStr(3),   forecast: 26, lower_bound: 22, upper_bound: 30 },
  { date: dateStr(4),   forecast: 29, lower_bound: 25, upper_bound: 33 },
  { date: dateStr(5),   forecast: 27, lower_bound: 23, upper_bound: 31 },
  { date: dateStr(6),   forecast: 28, lower_bound: 24, upper_bound: 32 },
  { date: dateStr(7),   forecast: 30, lower_bound: 26, upper_bound: 34 },
];

const SUGAR_DATA: ForecastPoint[] = [
  { date: dateStr(-13), actual: 15 },
  { date: dateStr(-12), actual: 14 },
  { date: dateStr(-11), actual: 16 },
  { date: dateStr(-10), actual: 18 },
  { date: dateStr(-9),  actual: 17 },
  { date: dateStr(-8),  actual: 19 },
  { date: dateStr(-7),  actual: 20 },
  { date: dateStr(-6),  actual: 18 },
  { date: dateStr(-5),  actual: 22 },
  { date: dateStr(-4),  actual: 21 },
  { date: dateStr(-3),  actual: 23 },
  { date: dateStr(-2),  actual: 20 },
  { date: dateStr(-1),  actual: 24 },
  { date: dateStr(0),   actual: 22 },
  { date: dateStr(1),   forecast: 23, lower_bound: 19, upper_bound: 27 },
  { date: dateStr(2),   forecast: 25, lower_bound: 21, upper_bound: 29 },
  { date: dateStr(3),   forecast: 24, lower_bound: 20, upper_bound: 28 },
  { date: dateStr(4),   forecast: 26, lower_bound: 22, upper_bound: 30 },
  { date: dateStr(5),   forecast: 25, lower_bound: 21, upper_bound: 29 },
  { date: dateStr(6),   forecast: 27, lower_bound: 23, upper_bound: 31 },
  { date: dateStr(7),   forecast: 26, lower_bound: 22, upper_bound: 30 },
];

const OIL_DATA: ForecastPoint[] = [
  { date: dateStr(-13), actual: 12 },
  { date: dateStr(-12), actual: 11 },
  { date: dateStr(-11), actual: 13 },
  { date: dateStr(-10), actual: 10 },
  { date: dateStr(-9),  actual: 14 },
  { date: dateStr(-8),  actual: 12 },
  { date: dateStr(-7),  actual: 11 },
  { date: dateStr(-6),  actual: 13 },
  { date: dateStr(-5),  actual: 10 },
  { date: dateStr(-4),  actual: 12 },
  { date: dateStr(-3),  actual: 11 },
  { date: dateStr(-2),  actual: 13 },
  { date: dateStr(-1),  actual: 12 },
  { date: dateStr(0),   actual: 11 },
  { date: dateStr(1),   forecast: 12, lower_bound: 9,  upper_bound: 15 },
  { date: dateStr(2),   forecast: 11, lower_bound: 8,  upper_bound: 14 },
  { date: dateStr(3),   forecast: 13, lower_bound: 10, upper_bound: 16 },
  { date: dateStr(4),   forecast: 12, lower_bound: 9,  upper_bound: 15 },
  { date: dateStr(5),   forecast: 11, lower_bound: 8,  upper_bound: 14 },
  { date: dateStr(6),   forecast: 12, lower_bound: 9,  upper_bound: 15 },
  { date: dateStr(7),   forecast: 13, lower_bound: 10, upper_bound: 16 },
];

const ATTA_DATA: ForecastPoint[] = [
  { date: dateStr(-13), actual: 40 },
  { date: dateStr(-12), actual: 38 },
  { date: dateStr(-11), actual: 42 },
  { date: dateStr(-10), actual: 36 },
  { date: dateStr(-9),  actual: 44 },
  { date: dateStr(-8),  actual: 41 },
  { date: dateStr(-7),  actual: 39 },
  { date: dateStr(-6),  actual: 43 },
  { date: dateStr(-5),  actual: 37 },
  { date: dateStr(-4),  actual: 45 },
  { date: dateStr(-3),  actual: 42 },
  { date: dateStr(-2),  actual: 40 },
  { date: dateStr(-1),  actual: 38 },
  { date: dateStr(0),   actual: 41 },
  { date: dateStr(1),   forecast: 42, lower_bound: 37, upper_bound: 47 },
  { date: dateStr(2),   forecast: 40, lower_bound: 35, upper_bound: 45 },
  { date: dateStr(3),   forecast: 43, lower_bound: 38, upper_bound: 48 },
  { date: dateStr(4),   forecast: 39, lower_bound: 34, upper_bound: 44 },
  { date: dateStr(5),   forecast: 41, lower_bound: 36, upper_bound: 46 },
  { date: dateStr(6),   forecast: 44, lower_bound: 39, upper_bound: 49 },
  { date: dateStr(7),   forecast: 42, lower_bound: 37, upper_bound: 47 },
];

// ────────────────────────────────────────────────────────────
// Exported lookup — keyed by product name
// ────────────────────────────────────────────────────────────

export const SEED_FORECASTS: Record<string, ProductForecast> = {
  Rice: {
    product_name: "Rice",
    expected_demand: 30,
    trend_7d_pct: -5.2,
    confidence_pct: 94,
    market_label: "Stable Market",
    is_anomaly: false,
    anomaly_pct: 0,
    forecast_7d: RICE_DATA,
  },
  Dal: {
    product_name: "Dal",
    expected_demand: 25,
    trend_7d_pct: 8.4,
    confidence_pct: 91,
    market_label: "Rising Demand",
    is_anomaly: false,
    anomaly_pct: 0,
    forecast_7d: DAL_DATA,
  },
  Sugar: {
    product_name: "Sugar",
    expected_demand: 22,
    trend_7d_pct: 12.1,
    confidence_pct: 88,
    market_label: "Seasonal Spike",
    is_anomaly: true,
    anomaly_pct: 18.3,
    forecast_7d: SUGAR_DATA,
  },
  "Cooking Oil": {
    product_name: "Cooking Oil",
    expected_demand: 12,
    trend_7d_pct: -1.8,
    confidence_pct: 96,
    market_label: "Stable Market",
    is_anomaly: false,
    anomaly_pct: 0,
    forecast_7d: OIL_DATA,
  },
  Atta: {
    product_name: "Atta",
    expected_demand: 41,
    trend_7d_pct: 3.6,
    confidence_pct: 92,
    market_label: "Steady Growth",
    is_anomaly: false,
    anomaly_pct: 0,
    forecast_7d: ATTA_DATA,
  },
};
