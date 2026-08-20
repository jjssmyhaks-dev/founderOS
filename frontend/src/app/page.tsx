"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import { Zap, Bot, Shield, BarChart3, Workflow, Brain, ChevronRight, Sparkles, CheckCircle2, Globe } from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  // Redirect authenticated users to app
  if (isAuthenticated) {
    return (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    );
  }

  return <LandingPage />;
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Nav */}
      <nav className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/60 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Helm</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/login" className="px-5 py-2.5 bg-[var(--accent)] hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--accent)_0%,_transparent_60%)] opacity-[0.07]" />
        <div className="max-w-6xl mx-auto px-6 py-28 md:py-36 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-full text-xs text-[var(--accent)] font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            21 AI specialists working for you
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight mb-6">
            Your AI operating
            <br />
            <span className="bg-gradient-to-r from-[var(--accent)] to-purple-400 bg-clip-text text-transparent">system for business</span>
          </h1>
          <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
            One conversation. Twenty-one specialist agents. Research, marketing, operations, and finance &mdash; all orchestrated to run your solo business.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="px-8 py-3.5 bg-[var(--accent)] hover:opacity-90 text-white font-semibold rounded-lg text-sm transition-opacity flex items-center gap-2">
              Start Free
              <ChevronRight className="w-4 h-4" />
            </Link>
            <a href="#features" className="px-8 py-3.5 bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40 text-[var(--text-secondary)] hover:text-white font-medium rounded-lg text-sm transition-all">
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-4">Everything your business needs</h2>
        <p className="text-[var(--text-secondary)] text-center max-w-xl mx-auto mb-14">Helm replaces the need for multiple hires. Each layer handles an entire function of your business.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { icon: Brain, title: "Research", desc: "Competitor intelligence, market trends, customer insights, and pricing benchmarks.", color: "#3b82f6", agents: "5 agents" },
            { icon: Globe, title: "Marketing", desc: "Content strategy, SEO, social media, paid campaigns, and brand management.", color: "#a855f7", agents: "6 agents" },
            { icon: Workflow, title: "Operations", desc: "Process optimization, vendor management, quality control, and scheduling.", color: "#f59e0b", agents: "5 agents" },
            { icon: BarChart3, title: "Finance", desc: "Bookkeeping, cashflow forecasting, pricing, compliance, and investor relations.", color: "#22c55e", agents: "5 agents" },
          ].map((f) => (
            <div key={f.title} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 hover:border-[var(--accent)]/30 transition-colors group">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: f.color + "15" }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 className="text-white font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-3">{f.desc}</p>
              <span className="text-xs font-medium" style={{ color: f.color }}>{f.agents}</span>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-[var(--border)] bg-[var(--bg-secondary)]/30">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-14">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Tell Helm about your business", desc: "A natural conversation sets up your context, goals, and preferences. Takes 2 minutes." },
              { step: "2", title: "Ask or assign tasks", desc: "Type what you need. Helm routes it to the right specialist agents automatically." },
              { step: "3", title: "Review and approve", desc: "High-risk actions wait for your approval. Everything else runs autonomously within your rules." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] font-bold text-sm mx-auto mb-4">{s.step}</div>
                <h3 className="text-white font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / Social Proof */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">Built for solo founders who need leverage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl mx-auto mb-8">
            {[
              { label: "Agent types", value: "21" },
              { label: "Business layers", value: "4" },
              { label: "Risk tiers", value: "3" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-[var(--accent)] mb-1">{s.value}</div>
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{s.label}</div>
              </div>
            ))}
          </div>
          <ul className="flex flex-wrap justify-center gap-3 text-sm text-[var(--text-secondary)]">
            {["Autonomous execution", "Approval gates", "Full observability", "Memory system", "21 specialist agents", "Real-time activity"].map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to hand off the busywork?</h2>
        <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">Your AI team is ready. Start the conversation and let Helm handle the rest.</p>
        <Link href="/login" className="inline-flex items-center gap-2 px-8 py-4 bg-[var(--accent)] hover:opacity-90 text-white font-semibold rounded-lg text-sm transition-opacity">
          Get Started Free
          <ChevronRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-[var(--accent)] flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span>Helm AI OS</span>
          </div>
          <span>&copy; {new Date().getFullYear()} Helm. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
