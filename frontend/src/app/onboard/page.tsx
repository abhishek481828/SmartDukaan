"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { register, type AuthResponse } from "@/lib/api";


const CATEGORIES = ["Grains", "Dairy", "FMCG", "Vegetables", "General"];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    shop_name: "",
    city: "",
    state: "",
    language: "en",
    categories: [] as string[],
  });

  const validateStepOne = () => {
    if (!form.name.trim()) return "Please enter your name";
    if (!form.phone.trim()) return "Please enter your phone number";
    if (!form.password.trim()) return "Please enter a password";
    if (!form.shop_name.trim()) return "Please enter your shop name";
    return null;
  };

  const validateStepTwo = () => {
    if (!form.city.trim()) return "Please enter your city";
    if (!form.state.trim()) return "Please enter your state";
    return null;
  };

  const handleNext = () => {
    const message = validateStepOne();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep(2);
  };

  const handleSubmit = async () => {
    const message = validateStepTwo();
    if (message) {
      setError(message);
      return;
    }
    try {
      setError("");
      setSubmitting(true);
      const res: AuthResponse = await register({
        ...form,
        categories: form.categories.length > 0 ? form.categories : ["general"],
      });
      localStorage.setItem("bv_token", res.access_token);
      localStorage.setItem("bv_user", JSON.stringify(res.user));
      localStorage.setItem("bv_shop", JSON.stringify(res.shop));
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed. Please check your inputs.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setError("");
    setForm((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat) ? prev.categories.filter((c) => c !== cat) : [...prev.categories, cat],
    }));
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
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="glass-card overflow-hidden border-none p-8 shadow-2xl backdrop-blur-2xl md:p-10">
          <div className="text-center">
            <Link href="/" className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-2xl font-black text-white shadow-lg shadow-orange-900/20">
              B
            </Link>
            <h1 className="mt-8 text-4xl font-extrabold tracking-[-0.05em] text-[var(--color-text)]">
              Set up your shop
            </h1>
            <p className="mt-3 text-lg text-[var(--color-text-soft)]">
              Step {step} of 2 — {step === 1 ? "Owner Details" : "Shop Configuration"}
            </p>
          </div>

          <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-orange-100">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: step === 1 ? "50%" : "100%" }}
              className="h-full bg-orange-600 transition-all duration-500"
            />
          </div>

          {error ? (
            <div className="surface-muted mt-6 border-[rgba(176,75,66,0.2)] px-4 py-3 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="mt-10 grid gap-6"
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold tracking-tight text-[var(--color-text)]">Your Name</label>
                    <input
                      placeholder="e.g. Ramesh Kumar"
                      className="field bg-white/60 focus:bg-white"
                      value={form.name}
                      onChange={(e) => { setError(""); setForm({ ...form, name: e.target.value }); }}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold tracking-tight text-[var(--color-text)]">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      className="field bg-white/60 focus:bg-white"
                      value={form.phone}
                      onChange={(e) => { setError(""); setForm({ ...form, phone: e.target.value }); }}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold tracking-tight text-[var(--color-text)]">Security PIN</label>
                  <input
                    type="password"
                    placeholder="••••"
                    className="field bg-white/60 focus:bg-white text-2xl tracking-[0.4em]"
                    value={form.password}
                    onChange={(e) => { setError(""); setForm({ ...form, password: e.target.value }); }}
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold tracking-tight text-[var(--color-text)]">Shop Name</label>
                  <input
                    placeholder="e.g. Ramesh Kirana Store"
                    className="field bg-white/60 focus:bg-white"
                    value={form.shop_name}
                    onChange={(e) => { setError(""); setForm({ ...form, shop_name: e.target.value }); }}
                    required
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button type="button" onClick={handleNext} className="btn-primary px-10 py-4 text-xl">
                    Next step
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="mt-10 grid gap-6"
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold tracking-tight text-[var(--color-text)]">City</label>
                    <input
                      placeholder="e.g. Warangal"
                      className="field bg-white/60 focus:bg-white"
                      value={form.city}
                      onChange={(e) => { setError(""); setForm({ ...form, city: e.target.value }); }}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold tracking-tight text-[var(--color-text)]">State</label>
                    <input
                      placeholder="e.g. Telangana"
                      className="field bg-white/60 focus:bg-white"
                      value={form.state}
                      onChange={(e) => { setError(""); setForm({ ...form, state: e.target.value }); }}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold tracking-tight text-[var(--color-text)]">Operator Language</label>
                  <select
                    className="field bg-white/60 focus:bg-white"
                    value={form.language}
                    onChange={(e) => { setError(""); setForm({ ...form, language: e.target.value }); }}
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="te">Telugu</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold tracking-tight text-[var(--color-text)]">Store Categories</label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {CATEGORIES.map((cat) => {
                      const value = cat.toLowerCase();
                      const active = form.categories.includes(value);
                      return (
                        <button
                          type="button"
                          key={cat}
                          onClick={() => toggleCategory(value)}
                          className={active 
                            ? "rounded-2xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-900/20" 
                            : "rounded-2xl border border-orange-100 bg-white/60 px-5 py-2.5 text-sm font-medium text-[var(--color-text-soft)] hover:bg-white hover:text-orange-600"}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-col-reverse gap-4 pt-4 sm:flex-row sm:justify-between">
                  <button type="button" onClick={() => setStep(1)} className="btn-secondary px-8 py-4">
                    Back
                  </button>
                  <button 
                    type="button" 
                    onClick={handleSubmit} 
                    disabled={submitting} 
                    className="btn-primary flex-1 py-4 text-xl"
                  >
                    {submitting ? "Launching workspace..." : "Create my shop"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-10 text-center border-t border-orange-50 pt-8">
            <p className="text-[var(--color-text-soft)]">
              Already have a shop?{" "}
              <Link href="/login" className="font-bold text-orange-600 hover:text-orange-700">
                Sign in instead
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
