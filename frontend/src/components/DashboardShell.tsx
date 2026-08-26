"use client";

import type { ReactNode } from "react";
import { AppShell } from "./AppShell";

interface DashboardShellProps {
  children: ReactNode;
  active?: string;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  return <AppShell>{children}</AppShell>;
}
