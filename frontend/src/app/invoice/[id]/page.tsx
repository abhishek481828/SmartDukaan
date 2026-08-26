"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download } from "lucide-react";
import { getInvoiceDetail, type InvoiceDetail } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function InvoiceViewPage() {
  const params = useParams<{ id: string }>();
  const invoiceId = useMemo(() => Number(params?.id), [params]);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!invoiceId) return;
    void getInvoiceDetail(invoiceId)
      .then((data) => {
        setInvoice(data);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load invoice"));
  }, [invoiceId]);

  return (
    <main className="min-h-screen px-4 py-6 md:px-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        {error ? <p className="surface-muted border-[rgba(198,92,77,0.22)] px-4 py-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
        {!error && !invoice ? <p className="surface px-5 py-5 text-sm text-[var(--color-text-soft)]">Loading invoice...</p> : null}

        {invoice ? (
          <div className="surface-strong p-6 md:p-8">
            <div className="mb-6 flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="eyebrow">Public invoice view</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">{invoice.shop_name}</h1>
                <p className="mt-2 text-sm text-[var(--color-text-soft)]">Invoice {invoice.invoice_number} · {invoice.date}</p>
              </div>
              <a href={`${API_URL}${invoice.pdf_url}`} target="_blank" rel="noreferrer" className="btn-primary">
                <Download size={16} />
                Download PDF
              </a>
            </div>

            <div className="mb-6 surface-muted px-4 py-4">
              <p className="eyebrow">Bill to</p>
              <p className="mt-2 text-lg font-medium text-[var(--color-text)]">{invoice.customer_name}</p>
              {invoice.customer_gstin ? <p className="mt-1 text-sm text-[var(--color-text-soft)]">GSTIN: {invoice.customer_gstin}</p> : null}
            </div>

            <div className="table-shell overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="table-head">
                    <th className="table-cell">Item</th>
                    <th className="table-cell">Qty</th>
                    <th className="table-cell">Rate</th>
                    <th className="table-cell">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, index) => (
                    <tr key={`${item.product}-${index}`} className="table-row">
                      <td className="table-cell font-medium text-[var(--color-text)]">{item.product}</td>
                      <td className="table-cell text-[var(--color-text-soft)]">{item.qty}</td>
                      <td className="table-cell text-[var(--color-text-soft)]">Rs.{item.unit_price}</td>
                      <td className="table-cell font-medium text-[var(--color-text)]">Rs.{item.amount ?? Number(item.qty) * Number(item.unit_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 ml-auto max-w-sm space-y-2">
              <div className="flex items-center justify-between text-sm text-[var(--color-text-soft)]"><span>Subtotal</span><span>Rs.{invoice.subtotal}</span></div>
              <div className="flex items-center justify-between text-sm text-[var(--color-text-soft)]"><span>CGST</span><span>Rs.{invoice.cgst}</span></div>
              <div className="flex items-center justify-between text-sm text-[var(--color-text-soft)]"><span>SGST</span><span>Rs.{invoice.sgst}</span></div>
              <div className="divider my-3" />
              <div className="flex items-center justify-between text-lg font-semibold text-[var(--color-text)]"><span>Total</span><span>Rs.{invoice.total}</span></div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
