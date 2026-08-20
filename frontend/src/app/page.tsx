"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/AppShell";
import {
  Zap, Bot, Shield, BarChart3, Workflow, Brain, ChevronRight,
  Sparkles, CheckCircle2, Globe, ArrowRight, Clock, Users,
  TrendingUp, Target, MessageSquare, DollarSign, FileText,
  AlertTriangle, Check, Star, Play, Lock, Menu, X
} from "lucide-react";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTimelineStep, setActiveTimelineStep] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Auto-cycle timeline on mobile
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTimelineStep((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">Helm</span>
            </Link>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              <a href="#how-it-works" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
                How it works
              </a>
              <a href="#layers" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
                Layers
              </a>
              <a href="#use-cases" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
                Use Cases
              </a>
              <a href="#pricing" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
                Pricing
              </a>
            </div>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className="text-sm text-[var(--text-secondary)] hover:text-white transition-colors">
              Sign in
            </Link>
            <Link href="/login" className="px-5 py-2.5 bg-[var(--accent)] hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity">
              Get started free
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-[var(--text-secondary)] hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--border)] bg-[var(--bg-secondary)]">
            <div className="px-6 py-4 space-y-4">
              <a href="#how-it-works" className="block text-sm text-[var(--text-secondary)] hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                How it works
              </a>
              <a href="#layers" className="block text-sm text-[var(--text-secondary)] hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                Layers
              </a>
              <a href="#use-cases" className="block text-sm text-[var(--text-secondary)] hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                Use Cases
              </a>
              <a href="#pricing" className="block text-sm text-[var(--text-secondary)] hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                Pricing
              </a>
              <div className="pt-4 border-t border-[var(--border)]">
                <Link href="/login" className="block w-full text-center px-5 py-2.5 bg-[var(--accent)] hover:opacity-90 text-white text-sm font-medium rounded-lg transition-opacity">
                  Get started free
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--accent)_0%,_transparent_60%)] opacity-[0.05]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[var(--accent)]/5 blur-[120px] rounded-full" />
        
        <div className="max-w-7xl mx-auto px-6 relative">
          {/* Eyebrow */}
          <div className="text-center mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-full text-sm text-[var(--text-secondary)]">
              <Sparkles className="w-4 h-4 text-[var(--accent)]" />
              For solo founders and small teams
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white text-center leading-tight tracking-tight mb-6">
            The AI team running your business
            <br />
            <span className="bg-gradient-to-r from-[var(--accent)] via-purple-400 to-pink-400 bg-clip-text text-transparent">
              while you build it
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-[var(--text-secondary)] text-center max-w-3xl mx-auto mb-10 leading-relaxed">
            Helm puts research, marketing, operations, and finance on autopilot &mdash; 21 specialist AI agents working from one chat, so a team of one can operate like a team of twenty.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/login" className="px-8 py-4 bg-[var(--accent)] hover:opacity-90 text-white font-semibold rounded-lg text-sm transition-opacity flex items-center gap-2">
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#how-it-works" className="px-8 py-4 bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40 text-[var(--text-secondary)] hover:text-white font-medium rounded-lg text-sm transition-all">
              See how it works
            </a>
          </div>

          {/* Trust Bar */}
          <div className="text-center">
            <p className="text-sm text-[var(--text-muted)]">
              Built for founders who can&apos;t hire a team yet &mdash; not for enterprises with one to spare.
            </p>
          </div>
        </div>
      </section>

      {/* Problem Section - Persona Pain Quotes */}
      <section className="py-20 md:py-28 bg-[var(--bg-secondary)]/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Running a business alone means running four jobs badly instead of one job well
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                category: "Speed",
                quote: "By the time I've researched the competitor, written the campaign, and checked if I can afford it, the week is gone.",
                role: "Solo Founder",
                company: "D2C Brand",
              },
              {
                category: "Context-switching",
                quote: "I'm not bad at marketing or finance individually. I'm bad at doing both in the same afternoon.",
                role: "Founder",
                company: "B2B SaaS",
              },
              {
                category: "Confidence",
                quote: "I make decisions fast because I have to, not because I trust them.",
                role: "Founder",
                company: "Services Business",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 relative"
              >
                <div className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-4">
                  {item.category}
                </div>
                <blockquote className="text-lg text-[var(--text-primary)] leading-relaxed mb-6">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                    <Users className="w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{item.role}</div>
                    <div className="text-xs text-[var(--text-muted)]">{item.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Three Pillars Section */}
      <section id="layers" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              One founder. Four layers. Zero new hires.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Research */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 hover:border-[var(--accent)]/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6">
                <Brain className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Research.</h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Continuous competitor tracking, market scanning, and pricing intelligence &mdash; running in the background, surfacing what matters instead of waiting to be asked.
              </p>
              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <div className="flex flex-wrap gap-2">
                  {["Competitor Intelligence", "Market Trends", "Pricing"].map((t) => (
                    <span key={t} className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Marketing & Operations */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 hover:border-[var(--accent)]/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-6">
                <Globe className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Marketing & Operations.</h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                From campaign copy to vendor coordination, Helm&apos;s specialist agents execute the work &mdash; not just suggest it &mdash; inside the guardrails you set.
              </p>
              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <div className="flex flex-wrap gap-2">
                  {["Content Strategy", "SEO", "Workflows"].map((t) => (
                    <span key={t} className="px-3 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Finance */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 hover:border-[var(--accent)]/30 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Finance.</h3>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Bookkeeping, cash flow forecasting, and compliance tracking that catches problems weeks before they&apos;d otherwise reach your inbox.
              </p>
              <div className="mt-6 pt-6 border-t border-[var(--border)]">
                <div className="flex flex-wrap gap-2">
                  {["Bookkeeping", "Cash Flow", "Compliance"].map((t) => (
                    <span key={t} className="px-3 py-1 bg-green-500/10 text-green-400 text-xs rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12">
            <Link href="/login" className="px-8 py-4 bg-[var(--accent)] hover:opacity-90 text-white font-semibold rounded-lg text-sm transition-opacity">
              Get started free
            </Link>
            <a href="#pricing" className="px-8 py-4 bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40 text-[var(--text-secondary)] hover:text-white font-medium rounded-lg text-sm transition-all">
              Book a walkthrough
            </a>
          </div>
        </div>
      </section>

      {/* How Helm Works - 3 Stages */}
      <section id="how-it-works" className="py-20 md:py-28 bg-[var(--bg-secondary)]/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">How Helm thinks</h2>
          </div>

          {/* Desktop: 3 stages */}
          <div className="hidden md:grid grid-cols-3 gap-8">
            {[
              {
                stage: "01",
                title: "21 specialist agents",
                desc: "Purpose-built agents for every function a small team needs — research, marketing, operations, and finance — each an expert in one job, not a generalist guessing at four.",
                icon: Bot,
                color: "blue",
              },
              {
                stage: "02",
                title: "One shared memory",
                desc: "Every agent works from the same up-to-date picture of your business — what you've decided, what you've rejected, what matters to you — so nothing gets re-explained and nothing falls through the cracks.",
                icon: Brain,
                color: "purple",
              },
              {
                stage: "03",
                title: "You stay at the helm",
                desc: "Every action is tiered by risk. Routine work runs on its own. Anything real — spend, external commitments, irreversible calls — comes to you first, with the reasoning attached.",
                icon: Shield,
                color: "green",
              },
            ].map((s, i) => (
              <div key={i} className="relative">
                {/* Connector line */}
                {i < 2 && (
                  <div className="absolute top-12 left-[calc(50%+40px)] right-[calc(-50%+40px)] h-[2px] bg-gradient-to-r from-[var(--accent)]/30 to-[var(--accent)]/10" />
                )}
                <div className="relative bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mx-auto mb-6">
                    <s.icon className={`w-8 h-8 ${
                      s.color === "blue" ? "text-blue-400" : 
                      s.color === "purple" ? "text-purple-400" : 
                      "text-green-400"
                    }`} />
                  </div>
                  <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider mb-2">
                    Stage {s.stage}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{s.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: Interactive timeline */}
          <div className="md:hidden">
            <div className="flex items-center justify-center gap-2 mb-8">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => setActiveTimelineStep(i)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    activeTimelineStep === i
                      ? "bg-[var(--accent)] w-8"
                      : "bg-[var(--border)]"
                  }`}
                />
              ))}
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 text-center">
              {[
                {
                  stage: "01",
                  title: "21 specialist agents",
                  desc: "Purpose-built agents for every function a small team needs — each an expert in one job, not a generalist guessing at four.",
                  icon: Bot,
                },
                {
                  stage: "02",
                  title: "One shared memory",
                  desc: "Every agent works from the same up-to-date picture of your business — so nothing gets re-explained and nothing falls through the cracks.",
                  icon: Brain,
                },
                {
                  stage: "03",
                  title: "You stay at the helm",
                  desc: "Every action is tiered by risk. Routine work runs on its own. Anything real comes to you first, with the reasoning attached.",
                  icon: Shield,
                },
              ].map((s, i) => (
                <div key={i} className={activeTimelineStep === i ? "" : "hidden"}>
                  <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center mx-auto mb-6">
                    <s.icon className="w-8 h-8 text-[var(--accent)]" />
                  </div>
                  <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider mb-2">
                    Stage {s.stage}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{s.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Proof / Results Section */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              What founders notice first
            </h2>
            <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
              Real results from founders using Helm. Coming soon as early users share their experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: "[Quote about time saved / decision confidence / catching something they'd have missed — to be filled with real user feedback post-launch]",
                name: "Coming Soon",
                role: "Early User",
                company: "Helm Beta",
              },
              {
                quote: "[Quote about time saved / decision confidence / catching something they'd have missed — to be filled with real user feedback post-launch]",
                name: "Coming Soon",
                role: "Early User",
                company: "Helm Beta",
              },
              {
                quote: "[Quote about time saved / decision confidence / catching something they'd have missed — to be filled with real user feedback post-launch]",
                name: "Coming Soon",
                role: "Early User",
                company: "Helm Beta",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8"
              >
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 text-[var(--accent)]/30" />
                  ))}
                </div>
                <blockquote className="text-[var(--text-secondary)] leading-relaxed mb-6 italic">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                    <Users className="w-5 h-5 text-[var(--text-muted)]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--text-muted)]">{item.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{item.role}, {item.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Use Cases */}
      <section id="use-cases" className="py-20 md:py-28 bg-[var(--bg-secondary)]/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Built for the moments that actually cost founders time
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: Target,
                title: "Track a competitor's every move",
                desc: "Pricing changes, campaign launches, positioning shifts — surfaced the day they happen.",
                color: "blue",
              },
              {
                icon: AlertTriangle,
                title: "Catch a cash flow problem before it's a crisis",
                desc: "Forecasting that flags risk weeks out, not the day rent is due.",
                color: "green",
              },
              {
                icon: TrendingUp,
                title: "Launch a campaign without a marketing hire",
                desc: "Strategy, copy, and execution handled end to end, on-brand by default.",
                color: "purple",
              },
              {
                icon: FileText,
                title: "Stay compliant without a back office",
                desc: "Deadline tracking and document prep that runs quietly in the background.",
                color: "amber",
              },
            ].map((uc, i) => (
              <div
                key={i}
                className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-8 hover:border-[var(--accent)]/30 transition-colors flex gap-6"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  uc.color === "blue" ? "bg-blue-500/10" :
                  uc.color === "green" ? "bg-green-500/10" :
                  uc.color === "purple" ? "bg-purple-500/10" :
                  "bg-amber-500/10"
                }`}>
                  <uc.icon className={`w-6 h-6 ${
                    uc.color === "blue" ? "text-blue-400" :
                    uc.color === "green" ? "text-green-400" :
                    uc.color === "purple" ? "text-purple-400" :
                    "text-amber-400"
                  }`} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">{uc.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{uc.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Onboarding Timeline */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              From signup to your first real result &mdash; in one conversation
            </h2>
            <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--accent)] hover:opacity-90 text-white font-semibold rounded-lg text-sm transition-opacity mt-6">
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Timeline */}
          <div className="relative max-w-4xl mx-auto" ref={timelineRef}>
            {/* Desktop: Horizontal */}
            <div className="hidden md:grid grid-cols-3 gap-8 relative">
              {/* Connecting line */}
              <div className="absolute top-8 left-[16.67%] right-[16.67%] h-[2px] bg-gradient-to-r from-[var(--accent)] via-[var(--accent)] to-[var(--accent)]/30" />
              
              {[
                {
                  day: "Day 1",
                  title: "Tell Helm what your business does",
                  desc: "Tell Helm what your business does and what's eating your time. It proposes one real action it can take immediately — not a demo, an actual result.",
                },
                {
                  day: "Week 1",
                  title: "Connect the tools you already use",
                  desc: "Connect the tools you already use — banking, ad accounts, calendars — only when an agent's work actually calls for it. No setup marathon required upfront.",
                },
                {
                  day: "Week 2–4",
                  title: "Helm learns your risk tolerance",
                  desc: "Actions you consistently approve without changes start running on their own. You spend less time approving and more time deciding.",
                },
              ].map((step, i) => (
                <div key={i} className="relative text-center">
                  {/* Dot */}
                  <div className="w-16 h-16 rounded-full bg-[var(--bg-secondary)] border-2 border-[var(--accent)] flex items-center justify-center mx-auto mb-6 relative z-10">
                    <span className="text-xs font-bold text-[var(--accent)]">{step.day.split(" ")[0]}</span>
                  </div>
                  <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider mb-2">
                    {step.day}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>

            {/* Mobile: Vertical */}
            <div className="md:hidden space-y-8">
              {[
                {
                  day: "Day 1",
                  title: "Tell Helm what your business does",
                  desc: "Tell Helm what your business does and what's eating your time. It proposes one real action it can take immediately — not a demo, an actual result.",
                },
                {
                  day: "Week 1",
                  title: "Connect the tools you already use",
                  desc: "Connect the tools you already use — banking, ad accounts, calendars — only when an agent's work actually calls for it. No setup marathon required upfront.",
                },
                {
                  day: "Week 2–4",
                  title: "Helm learns your risk tolerance",
                  desc: "Actions you consistently approve without changes start running on their own. You spend less time approving and more time deciding.",
                },
              ].map((step, i) => (
                <div key={i} className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-[var(--bg-secondary)] border-2 border-[var(--accent)] flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[var(--accent)]">{step.day.split(" ")[0]}</span>
                    </div>
                    {i < 2 && <div className="w-[2px] flex-1 bg-[var(--accent)]/20 mt-2" />}
                  </div>
                  <div className="pb-8">
                    <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider mb-1">
                      {step.day}
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Band */}
      <section className="py-20 md:py-28 bg-[var(--bg-secondary)]/30">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Stop being the bottleneck in your own company
          </h2>
          <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
            Your AI team is ready. Start the conversation and let Helm handle the rest.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="px-8 py-4 bg-[var(--accent)] hover:opacity-90 text-white font-semibold rounded-lg text-sm transition-opacity flex items-center gap-2">
              Get started free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="mailto:hello@dozero.ai" className="px-8 py-4 bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40 text-[var(--text-secondary)] hover:text-white font-medium rounded-lg text-sm transition-all">
              Talk to us
            </a>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-6">No credit card required to start.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white tracking-tight">Helm</span>
              </div>
              <p className="text-sm text-[var(--text-muted)]">
                © 2026 Helm — built by DoZero.ai
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-3">
                <li><a href="#how-it-works" className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">How it works</a></li>
                <li><a href="#layers" className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">Layers</a></li>
                <li><a href="#pricing" className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#security" className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-3">
                <li><a href="/docs" className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">Documentation</a></li>
                <li><a href="/changelog" className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">Changelog</a></li>
                <li><a href="/status" className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-3">
                <li><a href="/about" className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">About</a></li>
                <li><a href="mailto:hello@dozero.ai" className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-3">
                <li><a href="/terms" className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">Terms of Use</a></li>
                <li><a href="/privacy" className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#security" className="text-sm text-[var(--text-muted)] hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
