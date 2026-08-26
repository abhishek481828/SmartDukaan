"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell, PageHeader, SectionHeader } from "@/components/AppShell";
import { generateInvoice } from "@/lib/api";
import InvoicePreview from "@/components/InvoicePreview";

interface LineItem {
  product: string;
  qty: number;
  unit_price: number;
  gst_rate: number;
}

export default function InvoicePage() {
  const [customerName, setCustomerName] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ product: "", qty: 0, unit_price: 0, gst_rate: 5 }]);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const addItem = () => {
    setItems([...items, { product: "", qty: 0, unit_price: 0, gst_rate: 5 }]);
  };

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generateInvoice({
        shop_id: 1,
        customer_name: customerName,
        items,
      });
      setResult(res as Record<string, unknown>);
    } catch (err) {
      console.error("Invoice generation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell topbar={<span className="status-badge status-info">GST-ready invoice flow</span>}>
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        description="Draft a customer invoice, check the tax split, and generate a downloadable PDF."
      />

      {!result ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="surface p-6">
            <SectionHeader title="Invoice draft" description="Capture customer and line items with the current GST split." />
            <div className="space-y-6">
              <div>
                <label className="eyebrow">Customer name</label>
                <input placeholder="Enter customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="field mt-2" />
              </div>

              <div className="space-y-4">
                {items.map((item, i) => (
                  <div key={i} className="surface-muted p-4">
                    <div className="mb-4">
                      <label className="eyebrow">Product name</label>
                      <input placeholder="e.g. Aashirvaad Atta" value={item.product} onChange={(e) => updateItem(i, "product", e.target.value)} className="field mt-2" />
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="eyebrow">Qty</label>
                        <input placeholder="0" type="number" value={item.qty || ""} onChange={(e) => updateItem(i, "qty", Number(e.target.value))} className="field mt-2" />
                      </div>
                      <div>
                        <label className="eyebrow">Price</label>
                        <input placeholder="0" type="number" value={item.unit_price || ""} onChange={(e) => updateItem(i, "unit_price", Number(e.target.value))} className="field mt-2" />
                      </div>
                      <div>
                        <label className="eyebrow">GST</label>
                        <select value={item.gst_rate} onChange={(e) => updateItem(i, "gst_rate", Number(e.target.value))} className="field mt-2">
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addItem} className="btn-secondary w-full">
                <Plus size={16} />
                Add another item
              </button>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="surface p-5">
              <p className="eyebrow">Ready state</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">Generate final invoice</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-soft)]">The current flow preserves the existing backend behavior and generates the PDF after submission.</p>
              <button onClick={handleGenerate} disabled={loading} className="btn-primary mt-5 w-full disabled:opacity-60">
                {loading ? "Generating..." : "Generate GST invoice"}
              </button>
            </div>
          </aside>
        </div>
      ) : (
        <div className="space-y-6">
          <InvoicePreview invoice={result as never} customerName={customerName} items={items} />
          <button
            onClick={() => {
              setResult(null);
              setItems([{ product: "", qty: 0, unit_price: 0, gst_rate: 5 }]);
              setCustomerName("");
            }}
            className="btn-secondary"
          >
            Start new invoice
          </button>
        </div>
      )}
    </AppShell>
  );
}
