// ============================================================
// SmartDukaan — Mock Data Layer
// Toggle: NEXT_PUBLIC_USE_MOCKS=true in .env.local
// Every shape here EXACTLY matches the real API response format.
// ============================================================

// --- Auth ---
export const MOCK_REGISTER_RESPONSE = {
  access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicGhvbmUiOiI5ODc2NTQzMjEwIiwic2hvcF9pZCI6MSwibGFuZ3VhZ2UiOiJoaSIsImlhdCI6MTc0MzA3MjAwMCwiZXhwIjoxNzQzNjc2ODAwfQ.mock",
  user: { id: 1, name: "Ramesh Kumar", city: "Nagpur" },
  shop: { id: 1, shop_name: "Ramesh Kirana Store" },
};

export const MOCK_LOGIN_RESPONSE = MOCK_REGISTER_RESPONSE;

// --- Dashboard ---
export const MOCK_DASHBOARD = {
  shop: {
    id: 1,
    shop_name: "Ramesh Kirana Store",
    city: "Nagpur",
    categories: ["grains", "fmcg"],
  },
  top_products: [
    { id: 1, name: "Rice", today_qty: 30, today_revenue: 1350, trend_pct: -12, mandi_price: 39.5, risk_level: "HIGH" as const },
    { id: 2, name: "Dal", today_qty: 15, today_revenue: 1200, trend_pct: 5, mandi_price: 72, risk_level: "LOW" as const },
    { id: 3, name: "Sugar", today_qty: 20, today_revenue: 860, trend_pct: -3, mandi_price: 42, risk_level: "MEDIUM" as const },
    { id: 4, name: "Cooking Oil", today_qty: 10, today_revenue: 1500, trend_pct: 8, mandi_price: 145, risk_level: "LOW" as const },
    { id: 5, name: "Atta", today_qty: 25, today_revenue: 925, trend_pct: -18, mandi_price: 35, risk_level: "HIGH" as const },
  ],
  alerts: [
    { id: 1, product_name: "Rice", severity: "HIGH" as const, message: "Sales dropped 22% — competitor undercut by ₹2", created_at: "2026-03-27T06:00:00" },
    { id: 2, product_name: "Atta", severity: "MEDIUM" as const, message: "Restock needed in 4 days based on forecast", created_at: "2026-03-27T06:00:00" },
  ],
  total_today: { revenue: 5835, items_sold: 100, profit_estimate: 1420 },
};

// --- Forecast ---
export const MOCK_FORECAST = {
  product_name: "Rice",
  forecast_7d: [
    { date: "2026-03-28", predicted_qty: 28, lower_bound: 22, upper_bound: 34 },
    { date: "2026-03-29", predicted_qty: 31, lower_bound: 25, upper_bound: 37 },
    { date: "2026-03-30", predicted_qty: 26, lower_bound: 20, upper_bound: 32 },
    { date: "2026-03-31", predicted_qty: 33, lower_bound: 27, upper_bound: 39 },
    { date: "2026-04-01", predicted_qty: 29, lower_bound: 23, upper_bound: 35 },
    { date: "2026-04-02", predicted_qty: 35, lower_bound: 29, upper_bound: 41 },
    { date: "2026-04-03", predicted_qty: 30, lower_bound: 24, upper_bound: 36 },
  ],
  forecast_30d: [
    { date: "2026-03-28", predicted_qty: 28 },
    { date: "2026-03-29", predicted_qty: 31 },
    { date: "2026-03-30", predicted_qty: 26 },
    { date: "2026-03-31", predicted_qty: 33 },
    { date: "2026-04-01", predicted_qty: 29 },
    { date: "2026-04-02", predicted_qty: 35 },
    { date: "2026-04-03", predicted_qty: 30 },
  ],
  is_anomaly: false,
  anomaly_pct: -5.2,
};

export const MOCK_FORECASTS_BY_PRODUCT: Record<string, typeof MOCK_FORECAST> = {
  Rice: MOCK_FORECAST,
  Dal: { ...MOCK_FORECAST, product_name: "Dal", forecast_7d: MOCK_FORECAST.forecast_7d.map(f => ({ ...f, predicted_qty: f.predicted_qty - 10, lower_bound: f.lower_bound - 10, upper_bound: f.upper_bound - 10 })), is_anomaly: false, anomaly_pct: 2.1 },
  Sugar: { ...MOCK_FORECAST, product_name: "Sugar", forecast_7d: MOCK_FORECAST.forecast_7d.map(f => ({ ...f, predicted_qty: f.predicted_qty - 5, lower_bound: f.lower_bound - 5, upper_bound: f.upper_bound - 5 })), is_anomaly: true, anomaly_pct: -22.3 },
  "Cooking Oil": { ...MOCK_FORECAST, product_name: "Cooking Oil", forecast_7d: MOCK_FORECAST.forecast_7d.map(f => ({ ...f, predicted_qty: Math.round(f.predicted_qty * 0.4), lower_bound: Math.round(f.lower_bound * 0.4), upper_bound: Math.round(f.upper_bound * 0.4) })), is_anomaly: false, anomaly_pct: 8.0 },
  Atta: { ...MOCK_FORECAST, product_name: "Atta", forecast_7d: MOCK_FORECAST.forecast_7d.map(f => ({ ...f, predicted_qty: f.predicted_qty - 3, lower_bound: f.lower_bound - 3, upper_bound: f.upper_bound - 3 })), is_anomaly: true, anomaly_pct: -18.5 },
};

// --- Inventory ---
export const MOCK_INVENTORY = [
  { id: 1, name: "Rice", category: "Grains", in_stock: 45, unit: "kg", minimum_required: 100, status: "LOW_STOCK" as const, last_updated: "2026-03-27T10:00:00" },
  { id: 2, name: "Dal", category: "Grains", in_stock: 120, unit: "kg", minimum_required: 50, status: "IN_STOCK" as const, last_updated: "2026-03-27T09:30:00" },
  { id: 3, name: "Sugar", category: "Groceries", in_stock: 65, unit: "kg", minimum_required: 30, status: "IN_STOCK" as const, last_updated: "2026-03-27T11:15:00" },
  { id: 4, name: "Cooking Oil", category: "Groceries", in_stock: 45, unit: "litre", minimum_required: 20, status: "IN_STOCK" as const, last_updated: "2026-03-26T16:00:00" },
  { id: 5, name: "Atta", category: "Grains", in_stock: 15, unit: "kg", minimum_required: 40, status: "CRITICAL" as const, last_updated: "2026-03-27T08:45:00" },
];

// --- Market Prices ---
export const MOCK_MARKET_PRICES = {
  city: "Nagpur",
  prices: [
    { commodity: "Rice", price: 39.5, unit: "kg", source: "agmarknet", updated_at: "2026-03-27T04:00:00" },
    { commodity: "Dal", price: 72.0, unit: "kg", source: "agmarknet", updated_at: "2026-03-27T04:00:00" },
    { commodity: "Sugar", price: 42.0, unit: "kg", source: "agmarknet", updated_at: "2026-03-27T04:00:00" },
    { commodity: "Cooking Oil", price: 145.0, unit: "litre", source: "agmarknet", updated_at: "2026-03-27T04:00:00" },
    { commodity: "Atta", price: 35.0, unit: "kg", source: "agmarknet", updated_at: "2026-03-27T04:00:00" },
  ],
};

// --- Profit Simulation ---
export const MOCK_SIMULATE = {
  current_profit: 3200,
  projected_profit: 4580,
  delta: 1380,
  pct_change: 43.1,
  payback_days: 3,
  summary: "Reduce price by ₹3. Expected ₹1,380 extra profit in 7 days.",
};

// --- Invoice ---
export const MOCK_INVOICE = {
  invoice_id: "INV-001",
  pdf_url: "/api/invoice/1/pdf",
  total: 2047.5,
  gst_breakup: { cgst: 48.75, sgst: 48.75 },
};

export const MOCK_INVOICE_VIEW = {
  id: "INV-001",
  shop_name: "Ramesh Kirana Store",
  customer_name: "Sharma",
  date: "2026-03-27",
  items: [
    { product: "Rice", qty: 50, unit: "kg", unit_price: 39, gst_rate: 5, amount: 1950, gst_amount: 97.5 },
  ],
  subtotal: 1950,
  cgst: 48.75,
  sgst: 48.75,
  total: 2047.5,
};

// --- Voice Response ---
export const MOCK_VOICE_RESPONSE = {
  transcript: "Why is my rice sales dropping?",
  why_text: "Your competitor reduced rice price by ₹2/kg three days ago. Customers are price-sensitive for staples.",
  what_text: "Offer a combo deal: 5kg Rice + 1kg Dal at ₹275. This undercuts competitor while protecting margin.",
  rupees_impact: 1400,
};

// Pre-recorded demo transcripts (fallback if STT fails)
export const DEMO_TRANSCRIPTS = [
  { query: "Why is my rice sales dropping?", ...MOCK_VOICE_RESPONSE },
  {
    query: "Should I restock dal this week?",
    transcript: "Should I restock dal this week?",
    why_text: "Dal stock is at 15kg. Based on your 7-day forecast, you'll need 105kg this week.",
    what_text: "Order 90kg dal from your supplier now. Current mandi rate is ₹72/kg — prices may rise next week.",
    rupees_impact: 860,
  },
  {
    query: "Generate invoice for Sharma, 50kg rice",
    transcript: "Generate invoice for Sharma, 50kg rice",
    why_text: "Invoice will be generated at your selling price of ₹45/kg with 5% GST.",
    what_text: "GST invoice INV-002 ready for Sharma. Total: ₹2,362.50 (including ₹112.50 GST).",
    rupees_impact: 2362,
  },
];

// --- CSV Upload ---
export const MOCK_CSV_PREVIEW = {
  preview_rows: [
    { date: "2026-03-01", product: "Rice", qty: 30, price: 45 },
    { date: "2026-03-01", product: "Dal", qty: 15, price: 80 },
    { date: "2026-03-02", product: "Rice", qty: 28, price: 45 },
    { date: "2026-03-02", product: "Sugar", qty: 22, price: 43 },
    { date: "2026-03-03", product: "Rice", qty: 35, price: 45 },
  ],
  detected_columns: { date: "Date", product: "Product", qty: "Quantity", price: "Price" },
  row_count: 90,
};

export const MOCK_CSV_CONFIRM = {
  imported_count: 90,
  ml_retrain_triggered: true,
};
