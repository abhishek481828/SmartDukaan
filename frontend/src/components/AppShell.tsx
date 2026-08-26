"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  FileText,
  History,
  Home,
  Mic,
  Package,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import MicFAB from "./MicFAB";

type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: Home },
  { href: "/alerts", label: "Alerts", short: "Alerts", icon: Bell },
  { href: "/forecast", label: "Forecast", short: "Forecast", icon: TrendingUp },
  { href: "/inventory", label: "Inventory", short: "Stock", icon: Package },
  { href: "/transactions", label: "Transactions", short: "History", icon: History },
  { href: "/invoice", label: "Invoices", short: "Invoice", icon: FileText },
  { href: "/settings", label: "Settings", short: "Settings", icon: Settings },
];

export function AppShell({
  children,
  topbar,
}: {
  children: ReactNode;
  topbar?: ReactNode;
}) {
  return (
    <div suppressHydrationWarning className="page-shell">
      <div className="blob blob-warm left-[-120px] top-[120px] h-[320px] w-[320px]" />
      <div className="blob blob-cool right-[-80px] top-[220px] h-[280px] w-[280px]" />
      <div className="blob blob-warm bottom-[40px] right-[12%] h-[260px] w-[260px]" />
      <Sidebar />
      <div suppressHydrationWarning className="relative lg:pl-[300px]">
        <Topbar>{topbar}</Topbar>
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="page-wrap"
        >
          {children}
        </motion.main>
      </div>
      <BottomRail />
      <MicFAB />
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      suppressHydrationWarning
      className="fixed inset-y-0 left-0 z-30 hidden w-[300px] px-5 py-6 lg:flex lg:flex-col"
    >
      <div className="glass-card flex h-full flex-col px-5 py-5">
        <Link href="/dashboard" className="surface-strong mb-6 flex items-center gap-4 px-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#b76647,#c78955)] text-lg font-bold text-white shadow-[0_16px_34px_rgba(183,102,71,0.26)]">
            B
          </div>
          <div>
            <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--color-text)]">SmartDukaan</p>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">Retail OS</p>
          </div>
        </Link>

        <div className="px-2">
          <p className="eyebrow mb-3">Workspace</p>
        </div>

        <nav className="space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm font-medium transition-all",
                  active
                    ? "bg-[rgba(183,102,71,0.12)] text-[var(--color-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                    : "text-[var(--color-text-soft)] hover:bg-[rgba(183,102,71,0.08)] hover:text-[var(--color-text)]",
                )}
              >
                <Icon
                  size={18}
                  className={cn(
                    active
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]",
                  )}
                />
                <span>{item.label}</span>
                {active ? (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-[22px] border border-[rgba(183,102,71,0.18)]"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("bv-open-voice"))}
            className="btn-primary w-full"
          >
            <Mic size={16} />
            Ask SmartDukaan
          </button>
          <div className="surface p-4">
            <p className="text-sm font-medium text-[var(--color-text)]">Daily operator mode</p>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-soft)]">
              Track stock, spot risk, and handle invoices from one voice-first retail workspace.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ children }: { children?: ReactNode }) {
  return (
    <div suppressHydrationWarning className="sticky top-0 z-20 px-4 pt-4 md:px-8 lg:px-10">
      <div className="glass-card mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 py-4">
        <div>
          <p className="eyebrow">SmartDukaan</p>
          <p className="text-sm text-[var(--color-text-soft)]">Voice-first retail operating system</p>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key="topbar-slot"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function BottomRail() {
  const pathname = usePathname();

  return (
    <div suppressHydrationWarning className="fixed inset-x-0 bottom-0 z-30 px-3 pb-2 pt-1 lg:hidden">
      <div className="glass-card mx-auto max-w-xl px-2 py-2">
        <div className="flex items-center justify-between gap-1">
          {NAV_ITEMS.slice(0, 6).map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-[rgba(183,102,71,0.1)] text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)]",
                )}
              >
                <Icon size={18} />
                <span className="truncate">{item.short}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-copy">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "accent" | "success" | "warning";
}) {
  const toneClass =
    tone === "accent"
      ? "text-[var(--color-accent)]"
      : tone === "success"
        ? "text-[var(--color-success)]"
        : tone === "warning"
          ? "text-[var(--color-warning)]"
          : "text-[var(--color-text)]";

  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className={cn("metric-value", toneClass)}>{value}</p>
      {hint ? <p className="metric-hint">{hint}</p> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--color-text-soft)]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
