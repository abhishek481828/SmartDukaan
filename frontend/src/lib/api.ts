const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("bv_token");
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = getToken();
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = authHeaders(options?.headers);
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMessage = `API error: ${res.status} ${res.statusText}`;
    try {
      const data = await parseJsonResponse<unknown>(res);
      errorMessage = extractApiErrorMessage(data, errorMessage);
    } catch {}
    throw new Error(errorMessage);
  }

  return parseJsonResponse<T>(res);
}

function extractApiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;

  const payload = data as {
    detail?: unknown;
    error?: { message?: unknown };
    message?: unknown;
  };

  if (typeof payload.error?.message === "string" && payload.error.message.trim()) {
    return payload.error.message;
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  if (Array.isArray(payload.detail)) {
    const messages = payload.detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return null;

        const detailItem = item as { msg?: unknown; loc?: unknown };
        const msg = typeof detailItem.msg === "string" ? detailItem.msg : null;
        const loc = Array.isArray(detailItem.loc)
          ? detailItem.loc.filter((part): part is string | number => typeof part === "string" || typeof part === "number").join(" -> ")
          : null;

        if (!msg) return null;
        return loc ? `${loc}: ${msg}` : msg;
      })
      .filter((item): item is string => Boolean(item));

    if (messages.length > 0) return messages.join("; ");
  }

  return fallback;
}

async function uploadWithForm<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    let errorMessage = `API error: ${res.status} ${res.statusText}`;
    try {
      const data = await parseJsonResponse<unknown>(res);
      errorMessage = extractApiErrorMessage(data, errorMessage);
    } catch {}
    throw new Error(errorMessage);
  }

  return parseJsonResponse<T>(res);
}

export interface RegisterRequest {
  phone: string;
  name: string;
  password: string;
  city: string;
  state: string;
  language: string;
  shop_name: string;
  categories: string[];
  cold_start_path?: "benchmark" | "csv" | "ocr" | "voice";
}

export interface AuthResponse {
  access_token: string;
  user: { id: number; name: string; city: string };
  shop: { id: number; shop_name: string; cold_start_path?: string };
}

export interface InventoryItem {
  id: number;
  name: string;
  category: string;
  unit: string;
  in_stock: number;
  stock_qty: number;
  minimum_required: number;
  avg_daily_qty: number;
  status: "CRITICAL" | "LOW_STOCK" | "IN_STOCK";
  latest_update_at: string | null;
  latest_update_type: string | null;
  selling_price: number;
  cost_price: number | null;
}

export interface DashboardData {
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
}

export interface StockTransaction {
  id: number;
  product_id: number;
  product_name: string;
  unit: string;
  transaction_type: string;
  quantity_delta: number;
  balance_after: number;
  unit_price: number | null;
  reference_type: string | null;
  reference_id: number | null;
  notes: string | null;
  created_at: string | null;
}

export interface InvoiceItem {
  product_id?: number | null;
  product: string;
  qty: number;
  unit_price: number;
  gst_rate: number;
}

export interface InvoicePreview {
  shop: { id: number; shop_name: string; gstin?: string | null };
  customer_name: string;
  customer_gstin?: string | null;
  items: Array<InvoiceItem & { amount: number; gst_amount: number; stock_available?: number | null }>;
  subtotal: number;
  cgst: number;
  sgst: number;
  total: number;
}

export interface InvoiceDetail {
  id: number;
  invoice_number: string;
  date: string | null;
  customer_name: string;
  customer_gstin: string | null;
  shop_name: string;
  shop_gstin: string | null;
  items: Array<InvoiceItem & { amount?: number }>;
  subtotal: number;
  cgst: number;
  sgst: number;
  total: number;
  pdf_url: string;
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function login(data: { phone: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>("/api/dashboard");
}

export async function getInventory() {
  return request<InventoryItem[]>("/api/inventory");
}

export async function adjustInventory(data: {
  product_id: number;
  quantity_delta: number;
  transaction_type: "restock" | "manual_adjustment" | "sale";
  unit_price?: number;
  notes?: string;
}) {
  return request("/api/inventory/adjust", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function createProduct(data: {
  name: string;
  category: string;
  unit: string;
  selling_price: number;
  cost_price?: number;
  stock_qty: number;
}) {
  return request("/api/inventory/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getInventoryTransactions(params?: {
  product_id?: number;
  transaction_type?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.product_id) query.set("product_id", String(params.product_id));
  if (params?.transaction_type) query.set("transaction_type", params.transaction_type);
  if (params?.start_date) query.set("start_date", params.start_date);
  if (params?.end_date) query.set("end_date", params.end_date);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return request<StockTransaction[]>(`/api/inventory/transactions${suffix}`);
}

export interface RiskAlert {
  id: number;
  product_id: number;
  product_name: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  reason?: string;
  created_at: string;
}

export async function getForecast(productId: number | string) {
  return request(`/api/forecast/${productId}`);
}

export async function getAlerts() {
  return request<RiskAlert[]>("/api/alerts");
}

export async function runAlertsJob() {
  return request<{ status: string; alerts: RiskAlert[] }>("/api/alerts/run", {
    method: "POST",
  });
}

export async function getMarketPrices() {
  return request("/api/market/prices");
}

export async function simulate(data: {
  shop_id: number;
  product_id: number;
  action: string;
  current_price: number;
  suggested_price: number;
  avg_daily_qty: number;
}) {
  return request("/api/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function previewInvoice(data: {
  shop_id: number;
  customer_name: string;
  customer_gstin?: string | null;
  items: InvoiceItem[];
}) {
  return request<InvoicePreview>("/api/invoice/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function generateInvoice(data: {
  shop_id: number;
  customer_name: string;
  customer_gstin?: string | null;
  items: InvoiceItem[];
}) {
  return request<{
    invoice_id: number;
    invoice_number: string;
    pdf_url: string;
    detail_url: string;
    total: number;
    gst_breakup: { cgst: number; sgst: number };
  }>("/api/invoice/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getInvoiceDetail(invoiceId: number | string) {
  return request<InvoiceDetail>(`/api/invoice/${invoiceId}`);
}

export async function voiceQuery(shopId: number, transcript: string, language = "en") {
  return request("/api/voice/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop_id: shopId, transcript, language }),
  });
}

export async function downloadInvoicePdf(invoiceId: number): Promise<Blob> {
  const res = await fetch(`${API_URL}/api/invoice/${invoiceId}/pdf`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`PDF error: ${res.status}`);
  return res.blob();
}

export async function uploadCSV(file: File) {
  return uploadWithForm("/api/settings/csv", file);
}

export async function uploadOCRBill(file: File) {
  return uploadWithForm("/api/settings/ocr", file);
}

export async function confirmCSVImport(fileId: string, columnMapping: Record<string, string>, source: "csv" | "ocr" = "csv") {
  return request("/api/settings/csv/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId, column_mapping: columnMapping, source }),
  });
}

export async function getSettingsProfile() {
  return request<{
    user: { id: number; name: string; phone: string; language: string; city: string; state: string };
    shop: { id: number; shop_name: string; gstin?: string | null; city: string; state: string; categories: string[]; cold_start_path?: string; data_maturity_days?: number };
    notifications: { whatsapp_alerts_enabled: boolean; recipient_phone: string; owner_phone: string; phone_override?: string | null };
  }>("/api/settings/profile");
}

export async function updateSettingsProfile(data: {
  shop_name: string;
  city: string;
  state: string;
  gstin?: string | null;
  language: string;
  categories: string[];
  whatsapp_alerts_enabled?: boolean | null;
  whatsapp_phone_override?: string | null;
}) {
  return request<{ status: string }>("/api/settings/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function sendWhatsAppTestAlert() {
  return request<{ status: string; sid: string; to: string }>("/api/settings/whatsapp/test", {
    method: "POST",
  });
}

export async function saveVoiceJournalOnboarding(notes: string[]) {
  return request<{ saved_notes: number; cold_start_path: string }>("/api/settings/voice-journal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
}
