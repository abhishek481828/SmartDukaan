"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { login } from "@/lib/api";


export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("bv_token");
    if (token) router.push("/dashboard");
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await login({ phone: form.phone, password: form.password });
      localStorage.setItem("bv_token", data.access_token);
      localStorage.setItem("bv_user", JSON.stringify(data.user));
      localStorage.setItem("bv_shop", JSON.stringify(data.shop));
      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-20">
      {/* Background with image and overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ 
          backgroundImage: 'url("https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQebJVpH-Uvnd9wYgA8zviauA81itcWruO_zw&s")',
          opacity: 0.4
        }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent to-[var(--color-bg)]" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="glass-card overflow-hidden border-none p-8 shadow-2xl backdrop-blur-2xl md:p-10">
          <div className="text-center">
            <Link href="/" className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-2xl font-black text-white shadow-lg shadow-orange-900/20">
              B
            </Link>
            <h1 className="mt-8 text-4xl font-extrabold tracking-[-0.05em] text-[var(--color-text)]">
              Welcome back
            </h1>
            <p className="mt-3 text-lg text-[var(--color-text-soft)]">
              Sign in to manage your shop&apos;s operations
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-10 grid gap-6">
            {error ? (
              <div className="surface-muted border-[rgba(176,75,66,0.2)] px-4 py-3 text-sm text-[var(--color-danger)]">
                {error}
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-sm font-bold tracking-tight text-[var(--color-text)]">Phone number</label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                className="field bg-white/60 focus:bg-white"
                value={form.phone}
                onChange={(e) => {
                  setError("");
                  setForm({ ...form, phone: e.target.value });
                }}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-bold tracking-tight text-[var(--color-text)]">Security PIN</label>
              <input
                type="password"
                placeholder="••••"
                className="field bg-white/60 focus:bg-white text-2xl tracking-[0.4em]"
                value={form.password}
                onChange={(e) => {
                  setError("");
                  setForm({ ...form, password: e.target.value });
                }}
                required
              />
            </div>

            <button type="submit" className="btn-primary mt-2 w-full py-4 text-xl" disabled={loading}>
              {loading ? "Verifying..." : "Sign in to workspace"}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-[var(--color-text-soft)]">
              Don&apos;t have a shop yet?{" "}
              <Link href="/onboard" className="font-bold text-orange-600 hover:text-orange-700">
                Register now
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
