"use client";

import { useEffect, useState } from "react";
import { ClipboardList, PackagePlus, PlusSquare } from "lucide-react";
import { AppShell, PageHeader, SectionHeader, StatCard } from "@/components/AppShell";
import InventoryCard from "@/components/InventoryCard";
import {
  adjustInventory,
  createProduct,
  getInventory,
  getInventoryTransactions,
  type InventoryItem,
  type StockTransaction,
} from "@/lib/api";

const EMPTY_PRODUCT = {
  name: "",
  category: "",
  unit: "kg",
  selling_price: "",
  cost_price: "",
  stock_qty: "",
};

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [quantityDelta, setQuantityDelta] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"restock" | "manual_adjustment" | "sale">("restock");
  const [notes, setNotes] = useState("");
  const [newProduct, setNewProduct] = useState(EMPTY_PRODUCT);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [inventoryData, transactionData] = await Promise.all([getInventory(), getInventoryTransactions({ limit: 12 })]);
      setInventory(inventoryData);
      setTransactions(transactionData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const criticalItems = inventory.filter((item) => item.status === "CRITICAL");
  const lowItems = inventory.filter((item) => item.status === "LOW_STOCK");
  const inStockItems = inventory.filter((item) => item.status === "IN_STOCK");

  function triggerDashboardRefresh() {
    if (typeof window !== "undefined") {
      localStorage.setItem("bv_dashboard_refresh", String(Date.now()));
    }
  }

  async function handleSubmitAdjustment() {
    if (!selected) return;
    const parsedDelta = Number(quantityDelta);
    if (!parsedDelta) {
      setError("Enter a non-zero stock change.");
      return;
    }

    setSubmittingAdjustment(true);
    try {
      await adjustInventory({
        product_id: selected.id,
        quantity_delta: adjustmentType === "restock" ? Math.abs(parsedDelta) : -Math.abs(parsedDelta),
        transaction_type: adjustmentType,
        unit_price: adjustmentType === "sale" ? selected.selling_price : undefined,
        notes,
      });
      setQuantityDelta("");
      setNotes("");
      setSelected(null);
      triggerDashboardRefresh();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stock update failed");
    } finally {
      setSubmittingAdjustment(false);
    }
  }

  async function handleCreateProduct() {
    if (!newProduct.name || !newProduct.category || !newProduct.selling_price) {
      setError("Name, category, and selling price are required.");
      return;
    }

    setSubmittingProduct(true);
    try {
      await createProduct({
        name: newProduct.name,
        category: newProduct.category,
        unit: newProduct.unit || "kg",
        selling_price: Number(newProduct.selling_price),
        cost_price: newProduct.cost_price ? Number(newProduct.cost_price) : undefined,
        stock_qty: Number(newProduct.stock_qty || 0),
      });
      setNewProduct(EMPTY_PRODUCT);
      triggerDashboardRefresh();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product creation failed");
    } finally {
      setSubmittingProduct(false);
    }
  }

  return (
    <AppShell topbar={<span className="status-badge status-info">{inventory.length} products tracked</span>}>
      <PageHeader
        eyebrow="Inventory control"
        title="Inventory"
        description="Monitor stock health, post manual adjustments, and add new products without leaving the workspace."
      />

      <section className="app-grid md:grid-cols-3">
        <StatCard label="Tracked products" value={`${inventory.length}`} hint="Current product count across the catalog." />
        <StatCard label="Needs attention" value={`${criticalItems.length + lowItems.length}`} hint="Critical and low stock products." tone="warning" />
        <StatCard label="Recent movements" value={`${transactions.length}`} hint="Last 12 logged stock transactions." tone="accent" />
      </section>

      {error ? <div className="surface mt-6 border-[rgba(198,92,77,0.22)] p-4 text-sm text-[var(--color-danger)]">{error}</div> : null}

      <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-10">
          {loading ? (
            <div className="app-grid md:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="surface h-52 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {(criticalItems.length > 0 || lowItems.length > 0) && (
                <section>
                  <SectionHeader title="Needs attention" description="Products that are running below healthy stock thresholds." />
                  <div className="app-grid md:grid-cols-2">
                    {[...criticalItems, ...lowItems].map((item) => (
                      <InventoryCard key={item.id} item={item} onUpdate={setSelected} />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <SectionHeader title="Healthy stock" description="Products currently above their low-stock thresholds." />
                <div className="app-grid md:grid-cols-2">
                  {inStockItems.map((item) => (
                    <InventoryCard key={item.id} item={item} onUpdate={setSelected} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>

        <aside className="space-y-6">
          <section className="surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <PackagePlus size={18} className="text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-text)]">Update stock</h2>
            </div>

            {selected ? (
              <div className="space-y-4">
                <div className="surface-muted px-4 py-4">
                  <p className="eyebrow">Selected product</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{selected.name}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-soft)]">
                    Current balance: {selected.in_stock} {selected.unit}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType("restock")}
                    className={adjustmentType === "restock" ? "btn-primary px-1 text-xs" : "btn-secondary px-1 text-xs"}
                  >
                    Restock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType("sale")}
                    className={adjustmentType === "sale" ? "btn-primary px-1 text-xs" : "btn-secondary px-1 text-xs"}
                  >
                    Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType("manual_adjustment")}
                    className={adjustmentType === "manual_adjustment" ? "btn-primary px-1 text-xs" : "btn-secondary px-1 text-xs"}
                  >
                    Reduce
                  </button>
                </div>

                <input value={quantityDelta} onChange={(event) => setQuantityDelta(event.target.value)} placeholder={`Quantity in ${selected.unit}`} className="field" />
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notes for transaction history" rows={3} className="field min-h-24 resize-none" />

                <button type="button" onClick={() => void handleSubmitAdjustment()} disabled={submittingAdjustment} className="btn-primary w-full disabled:opacity-60">
                  {submittingAdjustment ? "Saving..." : "Save inventory update"}
                </button>
              </div>
            ) : (
              <p className="text-sm leading-6 text-[var(--color-text-soft)]">
                Choose any product card to post a restock, quick sale, or reduction. Every change writes a stock transaction and updates the current balance.
              </p>
            )}
          </section>

          <section className="surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <PlusSquare size={18} className="text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-text)]">Add new product</h2>
            </div>
            <div className="space-y-3">
              <input value={newProduct.name} onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))} placeholder="Product name" className="field" />
              <input value={newProduct.category} onChange={(event) => setNewProduct((current) => ({ ...current, category: event.target.value }))} placeholder="Category" className="field" />
              <div className="grid grid-cols-2 gap-3">
                <input value={newProduct.unit} onChange={(event) => setNewProduct((current) => ({ ...current, unit: event.target.value }))} placeholder="Unit" className="field" />
                <input value={newProduct.stock_qty} onChange={(event) => setNewProduct((current) => ({ ...current, stock_qty: event.target.value }))} placeholder="Opening stock" className="field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={newProduct.selling_price} onChange={(event) => setNewProduct((current) => ({ ...current, selling_price: event.target.value }))} placeholder="Selling price" className="field" />
                <input value={newProduct.cost_price} onChange={(event) => setNewProduct((current) => ({ ...current, cost_price: event.target.value }))} placeholder="Cost price" className="field" />
              </div>
              <button type="button" onClick={() => void handleCreateProduct()} disabled={submittingProduct} className="btn-primary w-full disabled:opacity-60">
                {submittingProduct ? "Creating..." : "Create product"}
              </button>
            </div>
          </section>

          <section className="surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList size={18} className="text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-text)]">Recent transactions</h2>
            </div>
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="surface-muted px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--color-text)]">{tx.product_name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{tx.transaction_type.replace(/_/g, " ")}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${tx.quantity_delta >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                        {tx.quantity_delta >= 0 ? "+" : ""}
                        {tx.quantity_delta} {tx.unit}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-soft)]">Balance {tx.balance_after}</p>
                    </div>
                  </div>
                  {tx.notes ? <p className="mt-2 text-sm text-[var(--color-text-soft)]">{tx.notes}</p> : null}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </AppShell>
  );
}

