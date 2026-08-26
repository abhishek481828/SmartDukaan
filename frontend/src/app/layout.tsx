import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeContext";

export const metadata: Metadata = {
  title: "SmartDukaan — Voice-First Retail Operating System",
  description: "Voice-first AI business intelligence for Indian Kirana stores. Ask questions in Hindi, English, or Telugu and get answers in seconds.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="light"
      data-accent="orange"
      data-scroll-behavior="smooth"
      className="h-full"
    >
      <body suppressHydrationWarning className="min-h-full font-sans bg-app text-[var(--color-text)]">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
