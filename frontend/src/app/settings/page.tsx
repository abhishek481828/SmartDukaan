"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader, SectionHeader } from "@/components/AppShell";
import {
  confirmCSVImport,
  getSettingsProfile,
  sendWhatsAppTestAlert,
  updateSettingsProfile,
  uploadCSV,
  uploadOCRBill,
} from "@/lib/api";

type CsvPreview = {
  file_id: string;
  preview_rows: Array<Record<string, string>>;
  detected_columns: Record<string, string>;
  row_count: number;
  ingestion_mode?: "csv" | "ocr";
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [csvUploading, setCsvUploading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [profile, setProfile] = useState({
    shop_name: "",
    city: "",
    state: "",
    gstin: "",
    language: "en",
    categories: [] as string[],
    whatsapp_alerts_enabled: false,
    recipient_phone: "",
    owner_phone: "",
    whatsapp_phone_override: "",
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getSettingsProfile();
        setProfile({
          shop_name: data.shop.shop_name || "",
          city: data.shop.city || "",
          state: data.shop.state || data.user.state || "",
          gstin: data.shop.gstin || "",
          language: data.user.language || "en",
          categories: Array.isArray(data.shop.categories) ? data.shop.categories : [],
          whatsapp_alerts_enabled: data.notifications?.whatsapp_alerts_enabled || false,
          recipient_phone: data.notifications?.recipient_phone || data.user.phone || "",
          owner_phone: data.notifications?.owner_phone || data.user.phone || "",
          whatsapp_phone_override: data.notifications?.phone_override || "",
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load settings profile.");
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, []);

  const handleProfileSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateSettingsProfile({
        ...profile,
        gstin: profile.gstin || null,
        whatsapp_phone_override: profile.whatsapp_phone_override.trim() || null,
      });
      setSuccess("Shop settings saved successfully.");
      setProfile((prev) => ({
        ...prev,
        recipient_phone: prev.whatsapp_phone_override.trim() || prev.owner_phone,
      }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: "csv" | "ocr" = "csv",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvUploading(true);
    setError("");
    setSuccess("");
    try {
      const preview = mode === "ocr" ? await uploadOCRBill(file) : await uploadCSV(file);
      setCsvPreview(preview as CsvPreview);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : `${mode.toUpperCase()} upload failed.`);
    } finally {
      setCsvUploading(false);
      e.target.value = "";
    }
  };

  const handleConfirmImport = async () => {
    if (!csvPreview) return;
    setError("");
    setSuccess("");
    try {
      await confirmCSVImport(
        csvPreview.file_id,
        csvPreview.detected_columns || {},
        csvPreview.ingestion_mode === "ocr" ? "ocr" : "csv",
      );
      setSuccess("Records imported successfully. Forecast persistence has been refreshed for this shop.");
      setCsvPreview(null);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Import confirmation failed.");
    }
  };

  const handleSendWhatsAppTest = async () => {
    setSendingTest(true);
    setError("");
    setSuccess("");
    try {
      const result = await sendWhatsAppTestAlert();
      setSuccess(`Test WhatsApp sent to ${result.to}.`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "WhatsApp test failed.");
    } finally {
      setSendingTest(false);
    }
  };

  const previewRows = csvPreview?.preview_rows || [];
  const detectedColumns = csvPreview?.detected_columns || {};
  const categoriesLabel = useMemo(
    () => (profile.categories.length ? profile.categories.join(", ") : "General"),
    [profile.categories],
  );

  return (
    <AppShell topbar={<span className="status-badge status-info">Shop settings</span>}>
      <PageHeader
        eyebrow="Settings"
        title="Shop settings and historical imports"
        description="Manage the live shop profile, language preferences, and older store records from one richer workspace."
      />

      {loading ? (
        <div className="app-grid md:grid-cols-2">
          <div className="metric-card h-44 animate-pulse" />
          <div className="metric-card h-44 animate-pulse" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-6">
            {error ? <div className="surface-muted border-[rgba(176,75,66,0.2)] px-4 py-3 text-sm text-[var(--color-danger)]">{error}</div> : null}
            {success ? <div className="surface-muted border-[rgba(45,123,86,0.18)] px-4 py-3 text-sm text-[var(--color-success)]">{success}</div> : null}

            <section className="glass-card p-6">
              <SectionHeader title="Shop settings" description="Update the live shop details used across dashboard, invoices, and onboarding." />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-text)]">Shop name</label>
                  <input className="field" value={profile.shop_name} onChange={(e) => setProfile((prev) => ({ ...prev, shop_name: e.target.value }))} placeholder="Shop name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-text)]">GSTIN</label>
                  <input className="field uppercase" value={profile.gstin} onChange={(e) => setProfile((prev) => ({ ...prev, gstin: e.target.value }))} placeholder="GSTIN" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-text)]">City</label>
                  <input className="field" value={profile.city} onChange={(e) => setProfile((prev) => ({ ...prev, city: e.target.value }))} placeholder="City" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-text)]">State</label>
                  <input className="field" value={profile.state} onChange={(e) => setProfile((prev) => ({ ...prev, state: e.target.value }))} placeholder="State" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-text)]">Language</label>
                  <select className="field" value={profile.language} onChange={(e) => setProfile((prev) => ({ ...prev, language: e.target.value }))}>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="te">Telugu</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--color-text)]">Categories</label>
                  <input className="field" value={categoriesLabel} readOnly placeholder="Categories" />
                </div>
              </div>
              <div className="mt-5 rounded-[24px] border border-[rgba(194,65,12,0.1)] bg-[rgba(255,255,255,0.28)] px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text)]">WhatsApp alerts</p>
                    <p className="mt-1 text-sm leading-7 text-[var(--color-text-soft)]">
                      Send low stock digests and high-risk alerts to the owner phone by default, or choose a different WhatsApp number below.
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">Recipient: {profile.recipient_phone || "No phone found"}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">Owner phone: {profile.owner_phone || "No phone found"}</p>
                  </div>
                  <label className="flex items-center gap-3 text-sm font-medium text-[var(--color-text)]">
                    <input
                      type="checkbox"
                      checked={profile.whatsapp_alerts_enabled}
                      onChange={(e) => setProfile((prev) => ({ ...prev, whatsapp_alerts_enabled: e.target.checked }))}
                    />
                    Enable WhatsApp alerts
                  </label>
                </div>
                <div className="mt-4 grid gap-2">
                  <label className="text-sm font-medium text-[var(--color-text)]">WhatsApp update number</label>
                  <input
                    className="field"
                    value={profile.whatsapp_phone_override}
                    onChange={(e) =>
                      setProfile((prev) => ({
                        ...prev,
                        whatsapp_phone_override: e.target.value,
                        recipient_phone: e.target.value.trim() || prev.owner_phone,
                      }))
                    }
                    placeholder="Leave blank to use owner phone"
                  />
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Enter the number that should receive alerts. Leave it blank to keep using the owner phone.
                  </p>
                </div>
              </div>
              <button type="button" onClick={handleProfileSave} className="btn-primary mt-6" disabled={saving}>
                {saving ? "Saving..." : "Save profile"}
              </button>
            </section>

            <section className="glass-card p-6">
              <SectionHeader title="Historical imports" description="Bring in older sales and billing records for a richer operating history." />

              {csvPreview ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="status-badge status-info">{csvPreview.row_count} rows detected</div>
                    <div className="status-badge status-success">{(csvPreview.ingestion_mode || "csv").toUpperCase()} import</div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="table-shell overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="table-head">
                            {Object.values(detectedColumns).map((col) => (
                              <th key={col} className="table-cell">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewRows.slice(0, 4).map((row, index) => (
                            <tr key={index} className="table-row">
                              {Object.keys(detectedColumns).map((key) => (
                                <td key={`${index}-${key}`} className="table-cell text-[var(--color-text-soft)]">
                                  {row[detectedColumns[key]] ?? row[key] ?? "-"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="surface p-5">
                      <p className="eyebrow">Detected columns</p>
                      <div className="mt-4 grid gap-2 text-sm text-[var(--color-text-soft)]">
                        {Object.entries(detectedColumns).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between gap-3 rounded-[16px] bg-[rgba(255,255,255,0.56)] px-3 py-2">
                            <span className="uppercase tracking-[0.18em] text-[var(--color-text-muted)]">{key}</span>
                            <span>{value}</span>
                          </div>
                        ))}
                      </div>
                      <button onClick={handleConfirmImport} className="btn-primary mt-5 w-full">
                        Confirm data import
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="glass-card block cursor-pointer px-6 py-8 text-left transition-transform hover:-translate-y-1">
                    <span className="eyebrow">CSV / Excel</span>
                    <span className="mt-3 block text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
                      {csvUploading ? "Uploading..." : "Upload historical sheet"}
                    </span>
                    <span className="mt-2 block text-sm leading-7 text-[var(--color-text-soft)]">
                      Use CSV-first onboarding or bulk import older sales from your spreadsheet workflow.
                    </span>
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => void handleFileUpload(e, "csv")} className="hidden" />
                  </label>
                  <label className="glass-card block cursor-pointer px-6 py-8 text-left transition-transform hover:-translate-y-1">
                    <span className="eyebrow">OCR / bill scan</span>
                    <span className="mt-3 block text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
                      {csvUploading ? "Uploading..." : "Upload bill scan"}
                    </span>
                    <span className="mt-2 block text-sm leading-7 text-[var(--color-text-soft)]">
                      Preview scanned bills through the same import review flow before records are confirmed.
                    </span>
                    <input type="file" accept=".csv,.txt,.pdf,.jpg,.jpeg,.png" onChange={(e) => void handleFileUpload(e, "ocr")} className="hidden" />
                  </label>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="surface p-6">
              <SectionHeader title="Language selection" description="Choose the operator language used across the workspace." />
              <select className="field" value={profile.language} onChange={(e) => setProfile((prev) => ({ ...prev, language: e.target.value }))}>
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="te">Telugu</option>
              </select>
            </section>

            <section className="surface p-6">
              <SectionHeader title="WhatsApp delivery" description="Test the current Twilio-backed alert channel for this shop." />
              <div className="space-y-3 text-sm leading-7 text-[var(--color-text-soft)]">
                <p>High-risk alerts send immediately. Low-stock alerts are bundled into a compact digest.</p>
                <p>The current MVP uses the owner account phone as the default WhatsApp recipient.</p>
              </div>
              <button
                type="button"
                onClick={handleSendWhatsAppTest}
                disabled={!profile.whatsapp_alerts_enabled || sendingTest}
                className="btn-secondary mt-5 w-full disabled:opacity-50"
              >
                {sendingTest ? "Sending test..." : "Send test WhatsApp"}
              </button>
            </section>

            <section className="surface p-6">
              <SectionHeader title="Import notes" description="The current settings flow uses real backend preview and confirm endpoints." />
              <div className="space-y-3 text-sm leading-7 text-[var(--color-text-soft)]">
                <p>Preview imports first, then confirm using the backend-returned file identifier.</p>
                <p>CSV and OCR uploads share the same confirmation path so historical records stay reviewable before they are committed.</p>
              </div>
            </section>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
