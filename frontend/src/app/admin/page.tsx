"use client";
import { useState, useEffect } from "react";
import { apiHeaders } from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  Activity, BarChart3, CheckCircle2, XCircle, Clock, TrendingUp,
  AlertTriangle, ArrowLeft, RefreshCw, Brain, Cpu, DollarSign,
  Target, ChevronRight
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const adminFetch = (path: string, opts?: RequestInit) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('helm_token') : null;
  return fetch(API + path, { ...opts, headers: { ...apiHeaders(token), ...opts?.headers } });
};

type Tab = "overview" | "traces" | "cost" | "leaderboard" | "evals" | "memory";

interface Trace {
  id: string; originType: string; originRef: string | null;
  founderId: string; startedAt: string; endedAt: string | null; status: string;
}

interface TraceDetail extends Trace {
  spans: Array<{
    id: string; spanType: string; status: string; agentId: string | null;
    inputSummary: string | null; outputSummary: string | null;
    error: string | null; tokensUsed: number | null;
    costEstimate: number | null; startedAt: string; endedAt: string | null;
  }>;
}

interface LayerMetric { layer: string; total: number; success: number; failed: number; cost: number; tokens: number; successRate: number; }
interface LeaderboardEntry { agentId: string; reliability: number; weeklyCost: number; totalTasks: number; failures: number; escalationRate: number; }
interface EvalRun { id: string; agentId: string; testSetVersion: string; totalTests: number; passedTests: number; failedTests: number; score: number | null; passed: boolean; triggeredBy: string; createdAt: string; }
interface MemoryNote { id: string; layer: string | null; category: string; memoryType: string; content: string; confidence: string; status: string; referenceCount: number; lastReferencedAt: string | null; createdAt: string; sourceAgentId: string | null; }

const LAYER_COLORS: Record<string, string> = {
  RESEARCH: 'from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400',
  MARKETING: 'from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-400',
  OPERATIONS: 'from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-400',
  FINANCE: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
};

const LAYER_ICON_COLORS: Record<string, string> = {
  RESEARCH: 'text-blue-400',
  MARKETING: 'text-purple-400',
  OPERATIONS: 'text-amber-400',
  FINANCE: 'text-emerald-400',
};

const spanTypeColors: Record<string, string> = {
  task: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  reasoning_step: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  tool_call: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  handoff: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  approval_wait: "bg-red-500/15 text-red-400 border-red-500/25",
  event_publish: "bg-gray-500/15 text-gray-400 border-gray-500/25",
};

const spanTypeLabels: Record<string, string> = { task: "Task", reasoning_step: "Reasoning", tool_call: "Tool Call", handoff: "Handoff", approval_wait: "Approval Wait", event_publish: "Event" };
const memTypeColors: Record<string, string> = { founder_preference: "bg-blue-500/15 text-blue-400", business_fact: "bg-emerald-500/15 text-emerald-400", decision_log: "bg-purple-500/15 text-purple-400", relationship_context: "bg-cyan-500/15 text-cyan-400", strategic_goal: "bg-amber-500/15 text-amber-400", constraint: "bg-red-500/15 text-red-400" };
const confidenceColors: Record<string, string> = { founder_stated: "text-emerald-400", confirmed: "text-blue-400", inferred: "text-gray-400" };

export default function AdminDashboard() {
  return (
    <ErrorBoundary>
      <AuthGuard>
        <AdminContent />
      </AuthGuard>
    </ErrorBoundary>
  );
}

function AdminContent() {
  const [tab, setTab] = useState<Tab>("overview");
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null);
  const [layerMetrics, setLayerMetrics] = useState<LayerMetric[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [evalHistory, setEvalHistory] = useState<EvalRun[]>([]);
  const [memories, setMemories] = useState<MemoryNote[]>([]);
  const [memTypeFilter, setMemTypeFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminFetch("/observability/metrics/layers?hours=168").then(r => r.json()).catch(() => []),
      adminFetch("/observability/leaderboard").then(r => r.json()).catch(() => []),
      adminFetch("/observability/eval/history").then(r => r.json()).catch(() => []),
    ]).then(([lm, lb, ev]) => { setLayerMetrics(lm); setLeaderboard(lb); setEvalHistory(ev); setLoading(false); });
  }, []);

  const loadTraces = async () => { const r = await adminFetch("/observability/traces?limit=50"); setTraces(await r.json()); };
  const loadTraceDetail = async (id: string) => { const r = await adminFetch("/observability/traces/" + id); setSelectedTrace(await r.json()); };
  const loadMemories = async (type?: string) => { const params = new URLSearchParams(); if (type) params.set("memoryType", type); const r = await adminFetch("/memory/00000000-0000-0000-0000-000000000000?" + params); setMemories(await r.json()); };

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-tertiary)] transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </a>
            <div>
              <h1 className="text-sm font-semibold text-white">Observability Dashboard</h1>
              <p className="text-[10px] text-[var(--text-muted)]">Traces, metrics, cost, memory, and evaluations</p>
            </div>
          </div>
          <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-white text-xs transition-colors">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/40 sticky top-14 z-20">
        <div className="max-w-7xl mx-auto px-6 flex gap-0.5 overflow-x-auto">
          {(["overview", "traces", "cost", "leaderboard", "evals", "memory"] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); if (t === "traces") loadTraces(); if (t === "memory") loadMemories(); }}
              className={"px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px " + (tab === t ? "text-white border-[var(--accent)]" : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]")}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Layer Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {layerMetrics.map((l, i) => {
                const colorKeys = ["RESEARCH", "MARKETING", "OPERATIONS", "FINANCE"];
                const ck = colorKeys[i % 4];
                return (
                  <div key={i} className={"rounded-xl border bg-gradient-to-br p-5 " + (LAYER_COLORS[ck] || LAYER_COLORS.RESEARCH)}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{l.layer}</span>
                      <Target className="w-4 h-4 opacity-50" />
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{l.total}</div>
                    <div className="flex items-center gap-2 text-xs opacity-70">
                      <span>{l.successRate}% success</span>
                      <span className="w-1 h-1 rounded-full bg-current opacity-40" />
                      <span>${l.cost.toFixed(2)} cost</span>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-white/40 transition-all duration-700" style={{ width: `${l.successRate}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent Evaluations */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[var(--accent)]" />
                  <h2 className="text-sm font-semibold text-white">Recent Evaluations</h2>
                </div>
                <button onClick={() => setTab("evals")} className="text-xs text-[var(--text-muted)] hover:text-white transition-colors flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {evalHistory.length === 0 ? (
                <div className="p-12 text-center text-[var(--text-muted)] text-sm">No eval runs yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                        <th className="px-5 py-3 text-xs font-medium">Agent</th>
                        <th className="px-5 py-3 text-xs font-medium">Score</th>
                        <th className="px-5 py-3 text-xs font-medium">Tests</th>
                        <th className="px-5 py-3 text-xs font-medium">Status</th>
                        <th className="px-5 py-3 text-xs font-medium">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evalHistory.slice(0, 8).map((e, i) => (
                        <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                          <td className="px-5 py-3 font-mono text-xs text-[var(--accent)]">{e.agentId.split(".").pop()}</td>
                          <td className="px-5 py-3">
                            <span className={"px-2 py-0.5 rounded-md text-xs font-medium " + (e.score && e.score >= 70 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>{e.score != null ? e.score + "%" : "N/A"}</span>
                          </td>
                          <td className="px-5 py-3 text-[var(--text-secondary)]">{e.passedTests}/{e.totalTests}</td>
                          <td className="px-5 py-3">{e.passed ? <span className="text-emerald-400 text-xs font-medium">PASS</span> : <span className="text-red-400 text-xs font-medium">FAIL</span>}</td>
                          <td className="px-5 py-3 text-xs text-[var(--text-muted)]">{new Date(e.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TRACES TAB */}
        {tab === "traces" && !selectedTrace && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Traces</h2>
              <button onClick={loadTraces} className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-white transition-colors">Refresh</button>
            </div>
            {traces.length === 0 ? (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-12 text-center text-[var(--text-muted)] text-sm">No traces yet.</div>
            ) : (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                      <th className="px-5 py-3 text-xs font-medium">Trace ID</th>
                      <th className="px-5 py-3 text-xs font-medium">Origin</th>
                      <th className="px-5 py-3 text-xs font-medium">Status</th>
                      <th className="px-5 py-3 text-xs font-medium">Started</th>
                      <th className="px-5 py-3 text-xs font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traces.map((t, i) => (
                      <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-tertiary)]/50 cursor-pointer transition-colors" onClick={() => loadTraceDetail(t.id)}>
                        <td className="px-5 py-3 font-mono text-xs text-[var(--accent)]">{t.id.substring(0, 12)}...</td>
                        <td className="px-5 py-3 text-xs text-[var(--text-secondary)]">{t.originType}</td>
                        <td className="px-5 py-3">
                          <span className={"px-2 py-0.5 rounded-md text-xs font-medium " + (t.status === "completed" ? "bg-emerald-500/15 text-emerald-400" : t.status === "failed" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400")}>{t.status}</span>
                        </td>
                        <td className="px-5 py-3 text-xs text-[var(--text-muted)]">{new Date(t.startedAt).toLocaleString()}</td>
                        <td className="px-5 py-3 text-xs text-[var(--text-secondary)]">{t.endedAt ? Math.round((new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime()) / 1000) + "s" : "..."}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TRACE DETAIL */}
        {tab === "traces" && selectedTrace && (
          <div>
            <button onClick={() => setSelectedTrace(null)} className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-white mb-4 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to traces
            </button>
            <div className="flex items-center gap-3 mb-4">
              <span className={"px-3 py-1 rounded-lg text-xs font-medium " + (selectedTrace.status === "completed" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>{selectedTrace.status}</span>
              <span className="text-xs text-[var(--text-muted)]">{selectedTrace.originType}</span>
            </div>
            <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Span Waterfall ({selectedTrace.spans.length} spans)</h2>
            <div className="space-y-1">
              {selectedTrace.spans.map((s, i) => {
                const dur = s.startedAt && s.endedAt ? new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime() : 0;
                return (
                  <div key={i} className={"flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors " + (s.spanType === "tool_call" ? "ml-8" : "")}>
                    <span className={"w-2 h-2 rounded-full shrink-0 " + (s.status === "success" ? "bg-emerald-400" : s.status === "failure" ? "bg-red-400" : "bg-amber-400")}></span>
                    <span className={"px-2 py-0.5 rounded text-xs border " + (spanTypeColors[s.spanType] || "bg-gray-800 text-gray-400 border-gray-700")}>{spanTypeLabels[s.spanType] || s.spanType}</span>
                    {s.outputSummary && <span className="text-xs text-[var(--text-secondary)] truncate max-w-xs">{s.outputSummary.substring(0, 80)}</span>}
                    {s.error && <span className="text-xs text-red-400">{s.error}</span>}
                    {s.tokensUsed && <span className="text-xs text-[var(--text-muted)] ml-auto">{s.tokensUsed} tok</span>}
                    <span className="text-xs text-[var(--text-muted)]">{dur}ms</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* COST TAB */}
        {tab === "cost" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-white">Cost by Layer (7 days)</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {layerMetrics.map((l, i) => {
                const colorKeys = ["RESEARCH", "MARKETING", "OPERATIONS", "FINANCE"];
                const ck = colorKeys[i % 4];
                return (
                  <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
                    <div className="text-xs text-[var(--text-muted)] mb-1">{l.layer}</div>
                    <div className="text-2xl font-bold text-white">${l.cost.toFixed(2)}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">{l.tokens.toLocaleString()} tokens across {l.total} spans</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {tab === "leaderboard" && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Agent Leaderboard (7 days)</h2>
            {leaderboard.length === 0 ? (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-12 text-center text-[var(--text-muted)] text-sm">No data yet.</div>
            ) : (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                      <th className="px-5 py-3 text-xs font-medium">#</th>
                      <th className="px-5 py-3 text-xs font-medium">Agent</th>
                      <th className="px-5 py-3 text-xs font-medium">Reliability</th>
                      <th className="px-5 py-3 text-xs font-medium">Weekly Cost</th>
                      <th className="px-5 py-3 text-xs font-medium">Tasks</th>
                      <th className="px-5 py-3 text-xs font-medium">Failures</th>
                      <th className="px-5 py-3 text-xs font-medium">Escalation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((e, i) => (
                      <tr key={i} className="border-b border-[var(--border)]/50 hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                        <td className="px-5 py-3 text-[var(--text-muted)]">{i + 1}</td>
                        <td className="px-5 py-3 font-mono text-xs text-[var(--accent)]">{e.agentId}</td>
                        <td className="px-5 py-3">
                          <span className={"px-2 py-0.5 rounded-md text-xs font-medium " + (e.reliability >= 90 ? "bg-emerald-500/15 text-emerald-400" : e.reliability >= 70 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400")}>{e.reliability}%</span>
                        </td>
                        <td className="px-5 py-3 text-[var(--text-secondary)]">${e.weeklyCost.toFixed(2)}</td>
                        <td className="px-5 py-3 text-[var(--text-secondary)]">{e.totalTasks}</td>
                        <td className="px-5 py-3 text-red-400">{e.failures}</td>
                        <td className="px-5 py-3 text-[var(--text-secondary)]">{e.escalationRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* EVALS TAB */}
        {tab === "evals" && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Evaluation Dashboard</h2>
            {evalHistory.length === 0 ? (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-12 text-center text-[var(--text-muted)] text-sm">No eval runs yet.</div>
            ) : (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                      <th className="px-5 py-3 text-xs font-medium">Agent</th>
                      <th className="px-5 py-3 text-xs font-medium">Score</th>
                      <th className="px-5 py-3 text-xs font-medium">Passed</th>
                      <th className="px-5 py-3 text-xs font-medium">Failed</th>
                      <th className="px-5 py-3 text-xs font-medium">Trigger</th>
                      <th className="px-5 py-3 text-xs font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evalHistory.map((e, i) => (
                      <tr key={i} className={"border-b border-[var(--border)]/50 transition-colors " + (!e.passed ? "bg-red-500/[0.02]" : "hover:bg-[var(--bg-tertiary)]/50")}>
                        <td className="px-5 py-3 font-mono text-xs text-[var(--accent)]">{e.agentId}</td>
                        <td className="px-5 py-3">
                          <span className={"px-2 py-0.5 rounded-md text-xs font-bold " + (e.score != null && e.score >= 70 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>{e.score != null ? e.score + "%" : "N/A"}</span>
                        </td>
                        <td className="px-5 py-3 text-emerald-400">{e.passedTests}</td>
                        <td className="px-5 py-3 text-red-400">{e.failedTests}</td>
                        <td className="px-5 py-3 text-xs text-[var(--text-muted)]">{e.triggeredBy}</td>
                        <td className="px-5 py-3 text-xs text-[var(--text-muted)]">{new Date(e.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MEMORY TAB */}
        {tab === "memory" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Founder Memory</h2>
              <div className="flex gap-1.5">
                {["", "founder_preference", "business_fact", "decision_log", "relationship_context", "strategic_goal", "constraint"].map(t => (
                  <button key={t || "all"} onClick={() => { setMemTypeFilter(t); loadMemories(t || undefined); }}
                    className={"px-2.5 py-1 rounded-lg text-xs font-medium transition-colors " + (memTypeFilter === t ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-white border border-[var(--border)]")}>
                    {t ? t.replace("_", " ") : "All"}
                  </button>
                ))}
              </div>
            </div>
            {memories.length === 0 ? (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-12 text-center text-[var(--text-muted)] text-sm">No memories stored yet. Memories are created from founder statements, approval decisions, and agent pattern detection.</div>
            ) : (
              <div className="space-y-2">
                {memories.map((m, i) => (
                  <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--accent)]/20 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={"px-2 py-0.5 rounded-md text-xs font-medium " + (memTypeColors[m.memoryType] || "bg-[var(--bg-tertiary)] text-[var(--text-muted)]")}>{m.memoryType.replace("_", " ")}</span>
                      {m.layer && <span className="px-2 py-0.5 rounded-md text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)]">{m.layer}</span>}
                      <span className={"text-xs " + (confidenceColors[m.confidence] || "text-[var(--text-muted)]")}>{m.confidence.replace("_", " ")}</span>
                      <span className="text-xs text-[var(--text-muted)] ml-auto">Ref: {m.referenceCount}x</span>
                      {m.status === "superseded" && <span className="px-2 py-0.5 rounded-md text-xs bg-amber-500/15 text-amber-400">superseded</span>}
                    </div>
                    <p className="text-sm text-[var(--text-primary)]">{m.content}</p>
                    <div className="text-xs text-[var(--text-muted)] mt-2">{m.lastReferencedAt ? "Last used " + new Date(m.lastReferencedAt).toLocaleDateString() : "Never retrieved"} · Created {new Date(m.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
