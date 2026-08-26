"use client";

import Link from "next/link";

interface Props {
  invoiceCount?: number;
  lastInvoiceId?: number;
  onGenerate?: () => void;
}

export default function InvoicePanel({ invoiceCount = 0, lastInvoiceId, onGenerate }: Props) {
  return (
    <div className="clay-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
          Invoices
        </p>
        {invoiceCount > 0 && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}
          >
            {invoiceCount} total
          </span>
        )}
      </div>

      {lastInvoiceId && (
        <Link
          href={`/invoice/${lastInvoiceId}`}
          className="flex items-center gap-3 px-4 py-3 transition-all duration-150 hover:opacity-80"
          style={{
            borderRadius: "var(--radius-md)",
            background: "var(--color-surface-0)",
            boxShadow: "var(--shadow-clay-inset)",
          }}
        >
          <span className="text-xl">📄</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-strong)" }}>
              BV-{String(lastInvoiceId).padStart(4, "0")}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-soft)" }}>
              Last generated invoice
            </p>
          </div>
          <span className="ml-auto text-sm" style={{ color: "var(--color-text-soft)" }}>→</span>
        </Link>
      )}

      <button
        onClick={onGenerate}
        className="clay-btn w-full text-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
        New Invoice
      </button>

      <Link
        href="/invoice"
        className="block text-center text-xs font-semibold transition-opacity hover:opacity-70"
        style={{ color: "var(--color-primary-500)" }}
      >
        View All Invoices →
      </Link>
    </div>
  );
}
