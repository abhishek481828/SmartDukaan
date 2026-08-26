interface LineItem {
  product: string;
  qty: number;
  unit_price: number;
  gst_rate: number;
}

interface InvoiceResult {
  invoice_id: string;
  invoice_number?: string;
  pdf_url: string;
  total: number;
  gst_breakup: { cgst: number; sgst: number };
}

export default function InvoicePreview({
  invoice,
  customerName,
  items,
}: {
  invoice: InvoiceResult;
  customerName: string;
  items: LineItem[];
}) {
  const subtotal = items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);

  return (
    <div className="surface-strong p-6">
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-[var(--color-border)] pb-5">
        <div>
          <p className="eyebrow">Generated invoice</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">Ramesh Kirana Store</h2>
          <p className="mt-1 text-sm text-[var(--color-text-soft)]">Invoice #{invoice.invoice_number || invoice.invoice_id}</p>
        </div>
        <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Download PDF
        </a>
      </div>

      <div className="mb-6 surface-muted px-4 py-4">
        <p className="eyebrow">Bill to</p>
        <p className="mt-2 text-lg font-medium text-[var(--color-text)]">{customerName || "Walk-in Customer"}</p>
      </div>

      <div className="table-shell overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="table-head">
              <th className="table-cell">Item</th>
              <th className="table-cell">Qty</th>
              <th className="table-cell">Rate</th>
              <th className="table-cell">GST</th>
              <th className="table-cell">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items
              .filter((item) => item.product)
              .map((item, index) => (
                <tr key={`${item.product}-${index}`} className="table-row">
                  <td className="table-cell font-medium text-[var(--color-text)]">{item.product}</td>
                  <td className="table-cell text-[var(--color-text-soft)]">{item.qty}</td>
                  <td className="table-cell text-[var(--color-text-soft)]">Rs.{item.unit_price}</td>
                  <td className="table-cell text-[var(--color-text-soft)]">{item.gst_rate}%</td>
                  <td className="table-cell font-medium text-[var(--color-text)]">Rs.{(item.qty * item.unit_price).toLocaleString("en-IN")}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 ml-auto max-w-sm space-y-2">
        <div className="flex items-center justify-between text-sm text-[var(--color-text-soft)]">
          <span>Subtotal</span>
          <span>Rs.{subtotal.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-[var(--color-text-soft)]">
          <span>CGST</span>
          <span>Rs.{invoice.gst_breakup.cgst}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-[var(--color-text-soft)]">
          <span>SGST</span>
          <span>Rs.{invoice.gst_breakup.sgst}</span>
        </div>
        <div className="divider my-3" />
        <div className="flex items-center justify-between text-lg font-semibold text-[var(--color-text)]">
          <span>Total</span>
          <span>Rs.{invoice.total.toLocaleString("en-IN")}</span>
        </div>
      </div>
    </div>
  );
}
