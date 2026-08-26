"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    label: "Alerts",
    href: "/alerts",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    label: "Demand Forecast",
    href: "/forecast",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    label: "Invoice",
    href: "/invoice",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93A10 10 0 0 1 21 12a10 10 0 0 1-10 10 10 10 0 0 1-10-10 10 10 0 0 1 3.51-7.55" />
      </svg>
    ),
    label: "Settings",
    href: "/settings",
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden lg:flex flex-col fixed left-0 top-0 h-full z-30"
      style={{
        width: "var(--sidebar-w, 272px)",
        background: "var(--color-surface-1)",
        boxShadow: "4px 0 24px rgba(146,121,96,0.10)",
        borderRight: "1px solid rgba(255,255,255,0.5)",
      }}
    >
      {/* Logo */}
      <div className="px-6 pt-8 pb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center text-white text-lg font-black"
            style={{
              background: "linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700))",
              borderRadius: "12px",
              boxShadow: "var(--shadow-clay-soft)",
            }}
          >
            S
          </div>
          <div>
            <p className="font-black text-base tracking-tight" style={{ color: "var(--color-text-strong)", fontFamily: "var(--font-syne, var(--font-display))" }}>
              SmartDukaan
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Retail Operating System
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 mb-4" style={{ height: "1px", background: "var(--color-surface-3)" }} />

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 transition-all duration-150 relative group"
              style={{
                borderRadius: "var(--radius-md)",
                background: isActive ? "var(--color-surface-0)" : "transparent",
                color: isActive ? "var(--color-primary-500)" : "var(--color-text-muted)",
                fontWeight: isActive ? 700 : 500,
                fontSize: "0.9rem",
                boxShadow: isActive ? "var(--shadow-clay)" : "none",
              }}
            >
              {/* Active pill */}
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5"
                  style={{ background: "var(--color-primary-500)", borderRadius: "0 4px 4px 0" }}
                />
              )}
              <span
                style={{ color: isActive ? "var(--color-primary-500)" : "var(--color-text-muted)" }}
                className="transition-colors duration-150 group-hover:text-[var(--color-primary-500)]"
              >
                {item.icon}
              </span>
              <span className="transition-colors duration-150 group-hover:text-[var(--color-text-strong)]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: mic shortcut */}
      <div className="p-4">
        <button
          className="w-full flex items-center gap-3 px-4 py-3 transition-all duration-150"
          style={{
            borderRadius: "var(--radius-md)",
            background: "linear-gradient(135deg, var(--color-primary-500), var(--color-primary-700))",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.875rem",
            boxShadow: "var(--shadow-clay-soft)",
            border: "none",
            cursor: "pointer",
          }}
          onClick={() => {
            const fab = document.querySelector("[data-mic-fab]") as HTMLButtonElement | null;
            fab?.click();
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          SmartDukaan se Poochho
        </button>

        {/* User area */}
        <div className="mt-3 flex items-center gap-3 px-2 py-2">
          <div
            className="w-8 h-8 flex items-center justify-center text-white text-xs font-black shrink-0"
            style={{ borderRadius: "50%", background: "var(--color-surface-4)" }}
          >
            R
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text-strong)" }}>
              Ramesh Kumar
            </p>
            <p className="text-xs truncate" style={{ color: "var(--color-text-soft)" }}>
              Nagpur, MH
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
