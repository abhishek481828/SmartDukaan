"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader, SectionHeader, StatCard } from "@/components/AppShell";
import { getInventory, getInventoryTransactions, type InventoryItem, type StockTransaction } from "@/lib/api";

const TRANSACTION_TYPES = [
  { label: "All types", value: "" },
  { label: "Sales", value: "sale" },
  { label: "Invoice Sales", value: "invoice_sale" },
  { label: "Restocks", value: "restock" },
  { label: "Manual Adjustments", value: "manual_adjustment" },
];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [productId, setProductId] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    try {
      const [inventory, txs] = await Promise.all([
        getInventory(),
        getInventoryTransactions({
          product_id: productId ? Number(productId) : undefined,
          transaction_type: transactionType || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          limit: 200,
        }),
      ]);
      setProducts(inventory);
      setTransactions(txs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transaction history");
    } finally {
      setLoading(false);
    }
  }, [productId, transactionType, startDate, endDate]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const summary = useMemo(() => {
    const totalMovement = transactions.reduce((sum, item) => sum + Math.abs(item.quantity_delta), 0);
    const restocks = transactions.filter((item) => item.transaction_type === "restock").length;
    const sales = transactions.filter((item) => item.transaction_type === "sale" || item.transaction_type === "invoice_sale").length;
    return { totalMovement, restocks, sales };
  }, [transactions]);

  return (
    <AppShell topbar={<span className="status-badge status-info">{transactions.length} entries</span>}>
      <PageHeader
        eyebrow="Ledger"
        title="Transactions"
        description="Filter stock movement history by product, transaction type, and date range."
      />

      <section className="app-grid md:grid-cols-3">
        <StatCard label="Entries" value={`${transactions.length}`} hint="Current rows matching active filters." />
        <StatCard label="Sales movements" value={`${summary.sales}`} hint="Sale and invoice-related movements." tone="success" />
        <StatCard label="Units moved" value={summary.totalMovement.toLocaleString("en-IN")} hint="Absolute quantity moved across the filtered set." tone="accent" />
      </section>

      {error ? <div className="surface mt-6 border-[rgba(198,92,77,0.22)] p-4 text-sm text-[var(--color-danger)]">{error}</div> : null}

      <section className="mt-10 surface p-5">
        <SectionHeader title="Filters" description="Adjust the ledger view without leaving the page." />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select value={productId} onChange={(event) => setProductId(event.target.value)} className="field">
            <option value="">All products</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>

          <select value={transactionType} onChange={(event) => setTransactionType(event.target.value)} className="field">
            {TRANSACTION_TYPES.map((item) => (
              <option key={item.value || "all"} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="field" />
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="field" />
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader title="Movement ledger" description="Every stock mutation from sales, invoices, restocks, and manual adjustments." />

        {loading ? (
          <div className="surface px-6 py-12 text-sm text-[var(--color-text-soft)]">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <p className="text-lg font-semibold text-[var(--color-text)]">No transactions found</p>
            <p className="mt-2 text-sm text-[var(--color-text-soft)]">Try loosening the filter set or logging new activity.</p>
          </div>
        ) : (
          <div className="table-shell overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="table-head">
                  <th className="table-cell">Date</th>
                  <th className="table-cell">Product</th>
                  <th className="table-cell">Type</th>
                  <th className="table-cell">Delta</th>
                  <th className="table-cell">Balance</th>
                  <th className="table-cell">Reference</th>
                  <th className="table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="table-row">
                    <td className="table-cell text-[var(--color-text-soft)]">
                      {tx.created_at ? new Date(tx.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "-"}
                    </td>
                    <td className="table-cell font-medium text-[var(--color-text)]">{tx.product_name}</td>
                    <td className="table-cell">
                      <span className="status-badge status-info">{tx.transaction_type.replace(/_/g, " ")}</span>
                    </td>
                    <td className={`table-cell font-semibold ${tx.quantity_delta >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                      {tx.quantity_delta >= 0 ? "+" : ""}
                      {tx.quantity_delta} {tx.unit}
                    </td>
                    <td className="table-cell text-[var(--color-text)]">
                      {tx.balance_after} {tx.unit}
                    </td>
                    <td className="table-cell text-[var(--color-text-soft)]">
                      {tx.reference_type ? `${tx.reference_type}${tx.reference_id ? ` #${tx.reference_id}` : ""}` : "-"}
                    </td>
                    <td className="table-cell text-[var(--color-text-soft)]">{tx.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
