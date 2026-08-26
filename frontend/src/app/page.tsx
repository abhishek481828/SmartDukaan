"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Mic, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
};

const features = [
  {
    icon: Mic,
    title: "Voice-First Operations",
    copy: "Talk to your shop in Hindi, Telugu, or English. Generate invoices, check stock, and get guidance naturally while you're busy at the counter.",
    color: "orange",
  },
  {
    icon: TrendingUp,
    title: "Predictive Intelligence",
    copy: "Spot high-demand trends and risk signals early. SmartDukaan watches your sales and inventory to warn you before products run out or demand drops.",
    color: "blue",
  },
  {
    icon: ShieldCheck,
    title: "Smart Growth Tools",
    copy: "From automated GST-ready invoicing to profit-margin guarding, get a workspace that manages the heavy lifting so you can focus on your customers.",
    color: "green",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-transparent">
      <div className="blob blob-warm left-[-120px] top-[120px] h-[360px] w-[360px]" />
      <div className="blob blob-cool right-[-80px] top-[140px] h-[320px] w-[320px]" />
      <div className="blob blob-green bottom-[220px] right-[16%] h-[260px] w-[260px]" />

      <header className="sticky top-0 z-30 px-4 pt-4 md:px-8 lg:px-10">
        <div className="glass-card mx-auto flex max-w-[1480px] items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#c2410c,#9a3412)] text-base font-bold text-white shadow-[0_16px_34px_rgba(194,65,12,0.28)]">
              S
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-[-0.03em] text-[var(--color-text)]">SmartDukaan</p>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-text-muted)]">
                Voice-First Retail OS
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {["Features", "Intelligence", "Workflow", "Pricing"].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-sm font-bold text-[var(--color-text-soft)] hover:text-[var(--color-text)]">
                {item}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
            <Link href="/onboard" className="btn-primary">
              Launch app
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 py-6 md:px-8 lg:px-10">
        <section className="hero-poster relative px-6 py-8 md:px-10 md:py-10 lg:grid lg:min-h-[78svh] lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-14 lg:py-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(194,65,12,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(3,105,161,0.12),transparent_24%)]" />

          <motion.div {...fadeUp} className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(194,65,12,0.14)] bg-[rgba(255,255,255,0.42)] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-accent)]">
              <Sparkles size={14} />
              Voice-first operating system for Indian retail
            </div>
            <h1 className="mt-6 text-[clamp(2rem,5vw,4.2rem)] font-bold leading-[1.1] tracking-[-0.05em] text-[var(--color-text)]">
              Run your store at the speed of thought.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--color-text-soft)] md:text-xl">
              SmartDukaan turns voice, stock movement, risk, invoicing, and demand context into one premium workspace built for Indian retail operators.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/onboard" className="btn-primary">
                Start setup
                <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="btn-secondary">
                Open existing workspace
              </Link>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Languages", value: "Hindi, Telugu, English" },
                { label: "Operator flow", value: "Voice to action" },
                { label: "Core value", value: "Faster daily decisions" },
              ].map((item) => (
                <div key={item.label} className="surface px-4 py-4">
                  <p className="metric-label">{item.label}</p>
                  <p className="mt-2 text-sm font-bold text-[var(--color-text)]">{item.value}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.08 }}
            className="relative z-10 mt-10 flex items-center justify-center lg:mt-0 lg:pl-10"
          >
            <div className="relative group">
              <div className="absolute -inset-8 bg-gradient-to-r from-orange-400/30 to-orange-600/30 rounded-[80px] blur-3xl opacity-0 group-hover:opacity-100 transition duration-1000"></div>
              <motion.div 
                whileHover={{ scale: 1.08, rotate: -2 }}
                transition={{ type: "spring", stiffness: 200, damping: 12 }}
                className="relative overflow-hidden rounded-[80px] shadow-[0_40px_100px_rgba(194,65,12,0.15)] ring-1 ring-orange-100/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src="https://i.pinimg.com/236x/af/25/01/af2501308a0e00ee4368c41a296f27e2.jpg" 
                  alt="SmartDukaan Store" 
                  className="w-[500px] h-[500px] object-cover transform transition-transform duration-1000 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-orange-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              </motion.div>
              
              {/* Decorative Floating Elements */}
              <motion.div 
                animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-10 -right-10 h-20 w-20 rounded-3xl bg-white/90 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] flex items-center justify-center text-orange-600 border border-orange-100/50 z-20"
              >
                <Sparkles size={32} />
              </motion.div>
              <motion.div 
                animate={{ y: [0, 15, 0], rotate: [0, 5, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -bottom-10 -left-10 h-20 w-20 rounded-3xl bg-white/90 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.08)] flex items-center justify-center text-blue-600 border border-blue-100/50 z-20"
              >
                <TrendingUp size={32} />
              </motion.div>
            </div>
          </motion.div>
        </section>

        <motion.section 
          {...fadeUp} 
          id="features" 
          className="mt-16 grid gap-8 lg:grid-cols-3"
        >
          {features.map((item, index) => {
            const Icon = item.icon;
            const colors = {
              orange: "bg-orange-50 text-orange-600 border-orange-100",
              blue: "bg-blue-50 text-blue-600 border-blue-100",
              green: "bg-green-50 text-green-600 border-green-100",
            };
            const accent = colors[item.color as keyof typeof colors];
            
            return (
              <motion.article
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                whileHover={{ y: -12, scale: 1.02 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                className="glass-card relative flex flex-col items-center p-10 text-center shadow-xl hover:shadow-2xl transition-all duration-500"
              >
                <div className={cn(
                  "mb-8 flex h-20 w-20 items-center justify-center rounded-[32px] border shadow-sm",
                  accent
                )}>
                  <Icon size={36} />
                </div>
                <h2 className="text-3xl font-extrabold tracking-[-0.04em] text-[var(--color-text)]">{item.title}</h2>
                <p className="mt-6 text-lg leading-8 text-[var(--color-text-soft)]">{item.copy}</p>
                <div className="mt-auto pt-8">
                  <div className="h-1.5 w-12 rounded-full bg-orange-100/50" />
                </div>
              </motion.article>
            );
          })}
        </motion.section>

        <motion.section
          {...fadeUp}
          id="workflow"
          className="mt-16 overflow-hidden rounded-[40px] bg-[linear-gradient(135deg,#c2410c,#7c2d12)] px-6 py-10 text-white shadow-[0_36px_82px_rgba(194,65,12,0.24)] md:px-10 md:py-12"
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="eyebrow text-[rgba(255,255,255,0.72)]">Launch SmartDukaan</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.05em] md:text-4xl">
                Put voice, risk, invoicing, and daily store decisions into one premium flow.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-7 text-[rgba(255,255,255,0.82)]">
                Set up the shop, choose your language, and start operating from a single workspace built around the real pace of Indian retail.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/onboard" className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/20">
                Start setup
              </Link>
              <Link href="/login" className="btn-secondary border-white/10 bg-white/10 text-white hover:bg-white/16">
                Sign in
              </Link>
            </div>
          </div>
        </motion.section>

        <footer className="mx-auto mt-10 flex max-w-[1480px] flex-col gap-3 px-1 pb-8 pt-2 text-sm text-[var(--color-text-muted)] md:flex-row md:items-center md:justify-between">
          <p>SmartDukaan for voice-first Indian retail operations.</p>
          <div className="flex flex-wrap gap-4">
            <a href="#features">Features</a>
            <a href="#intelligence">Intelligence</a>
            <a href="#workflow">Workflow</a>
          </div>
        </footer>
      </main>
    </div>
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}