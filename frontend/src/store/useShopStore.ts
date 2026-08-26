import { create } from "zustand";

export interface Product {
  id: number;
  name: string;
  product_name?: string;
  today_qty: number;
  today_revenue: number;
  trend_pct: number;
  mandi_price: number;
  risk_level: "HIGH" | "MEDIUM" | "LOW";
}

export interface Alert {
  id: number;
  product_name: string;
  level?: "HIGH" | "MEDIUM" | "LOW";
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  reason?: string;
  created_at: string;
}

export interface Shop {
  id: number;
  shop_name: string;
  city: string;
  state?: string;
  categories: string[];
  language?: string;
}

interface TotalToday {
  revenue: number;
  items_sold: number;
  profit_estimate: number;
}

interface ShopState {
  shop:       Shop | null;
  products:   Product[];
  alerts:     Alert[];
  totalToday: TotalToday | null;
  isLoading:  boolean;
  shopId:     number | null;

  setDashboardData: (data: {
    shop?: Shop;
    top_products?: Product[];
    products?: Product[];
    alerts?: Alert[];
    total_today?: TotalToday;
  }) => void;
  setProducts: (products: Product[]) => void;
  setLoading:  (loading: boolean) => void;
  addAlert:    (alert: Alert) => void;
  setShopId:   (id: number) => void;
}

export const useShopStore = create<ShopState>((set) => ({
  shop:       null,
  products:   [],
  alerts:     [],
  totalToday: null,
  isLoading:  true,
  shopId:     null,

  setDashboardData: (data) =>
    set({
      shop:       data.shop ?? null,
      products:   data.top_products ?? data.products ?? [],
      alerts:     data.alerts ?? [],
      totalToday: data.total_today ?? null,
      isLoading:  false,
      shopId:     data.shop?.id ?? null,
    }),

  setProducts: (products) => set({ products }),
  setLoading:  (loading)  => set({ isLoading: loading }),
  setShopId:   (id)       => set({ shopId: id }),

  addAlert: (alert) =>
    set((state) => {
      const existingIndex = state.alerts.findIndex((a) => a.id === alert.id);
      if (existingIndex >= 0) {
        const nextAlerts = [...state.alerts];
        nextAlerts[existingIndex] = { ...nextAlerts[existingIndex], ...alert };
        return { alerts: nextAlerts };
      }
      return { alerts: [alert, ...state.alerts] };
    }),
}));
