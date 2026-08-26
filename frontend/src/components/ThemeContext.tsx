"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";
export type Accent = "orange" | "teal" | "blue";

interface ThemeContextProps {
  theme: Theme;
  accent: Accent;
  setTheme: (t: Theme) => void;
  setAccent: (a: Accent) => void;
  mounted: boolean;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

function readStoredAccent(): Accent {
  const storedAccent = localStorage.getItem("bv_accent");
  return storedAccent === "teal" || storedAccent === "blue" || storedAccent === "orange" ? storedAccent : "orange";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccent] = useState<Accent>("orange");
  const [mounted, setMounted] = useState(false);
  const theme: Theme = "light";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setAccent(readStoredAccent());
      setMounted(true);
      localStorage.setItem("bv_theme", "light");
      localStorage.setItem("theme", "light");
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("data-accent", accent);
    localStorage.setItem("bv_accent", accent);
  }, [accent]);

  const setTheme = () => {};

  return <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent, mounted }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
