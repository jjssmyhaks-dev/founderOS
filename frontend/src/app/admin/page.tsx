"use client";
import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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

interface AgentMetric {
  agentId: string; period: string; totalSpans: number;
  successRate: number; failed: number; avgDurationMs: number;
  totalTokens: number; totalCost: number;
}

interface LayerMetric {
  layer: string; total: number; success: number; failed: number;
  cost: number; tokens: number; successRate: number;
}

interface LeaderboardEntry {
  agentId: string; reliability: number; weeklyCost: number;
  totalTasks: number; failures: number; escalationRate: number;
}

interface EvalRun {
  id: string; agentId: string; testSetVersion: string;
  totalTests: number; passedTests: number; failedTests: number;
  score: number | null; passed: boolean; triggeredBy: string; createdAt: string;
}

interface MemoryNote {
  id: string; layer: string | null; category: string; memoryType: string;
  content: string; confidence: string; status: string;
  referenceCount: number; lastReferencedAt: string | null;
  createdAt: string; sourceAgentId: string | null;
}

const spanTypeColors: Record<string, string> = {
  task: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  reasoning_step: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  tool_call: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  handoff: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  approval_wait: "bg-red-500/20 text-red-400 border-red-500/30",
  event_publish: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const spanTypeLabels: Record<string, string> = {
  task: "Task", reasoning_step: "Reasoning", tool_call: "Tool Call",
  handoff: "Handoff", approval_wait: "Approval Wait", event_publish: "Event",
};

const memTypeColors: Record<string, string> = {
  founder_preference: "bg-blue-500/20 text-blue-400",
  business_fact: "bg-emerald-500/20 text-emerald-400",
  decision_log: "bg-purple-500/20 text-purple-400",
  relationship_context: "bg-cyan-500/20 text-cyan-400",
  strategic_goal: "bg-amber-500/20 text-amber-400",
  constraint: "bg-red-500/20 text-red-400",
};

const confidenceColors: Record<string, string> = {
  founder_stated: "text-emerald-400",
  confirmed: "text-blue-400",
  inferred: "text-gray-400",
};

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceDetail | null>(null);
  const [agentMetrics, setAgentMetrics] = useState<AgentMetric[]>([]);
  const [layerMetrics, setLayerMetrics] = useState<LayerMetric[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [evalHistory, setEvalHistory] = useState<EvalRun[]>([]);
  const [memories, setMemories] = useState<MemoryNote[]>([]);
  const [memFilter, setMemFilter] = useState<string>("");
  const [memTypeFilter, setMemTypeFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(API + "/observability/metrics/layers?hours=168").then(r => r.json()).catch(() => []),
      fetch(API + "/observability/leaderboard").then(r => r.json()).catch(() => []),
      fetch(API + "/observability/eval/history").then(r => r.json()).catch(() => []),
    ]).then(([lm, lb, ev]) => {
      setLayerMetrics(lm); setLeaderboard(lb); setEvalHistory(ev);
      setLoading(false);
    });
  }, []);

  const loadTraces = async () => {
    const r = await fetch(API + "/observability/traces?limit=50");
    setTraces(await r.json());
  };

  const loadTraceDetail = async (id: string) => {
    const r = await fetch(API + "/observability/traces/" + id);
    setSelectedTrace(await r.json());
  };

  const loadMemories = async (type?: string) => {
    const params = new URLSearchParams();
    if (type) params.set("memoryType", type);
    const r = await fetch(API + "/memory/00000000-0000-0000-0000-000000000000?" + params);
    setMemories(await r.json());
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold">Observability Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Traces, metrics, cost, memory, agent leaderboard, and evaluations</p>
      </header>

      <div className="px-6 py-3 flex gap-1 border-b border-gray-800 overflow-x-auto">
        {(["overview", "traces", "cost", "leaderboard", "evals", "memory"] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t as Tab); if (t === "traces") loadTraces(); if (t === "memory") loadMemories(); }}
            className={"px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors " + (tab === t ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700")}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="p-6">
        {/* OVERVIEW */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {layerMetrics.map((l, i) => {
                const colors = ["bg-blue-500/20 text-blue-400", "bg-emerald-500/20 text-emerald-400", "bg-amber-500/20 text-amber-400", "bg-purple-500/20 text-purple-400"];
                return (
                  <div key={i} className={"rounded-lg border border-gray-800 p-4 " + colors[i % 4].split(" ")[0]}>
                    <div className="text-xs text-gray-500 mb-1">{l.layer}</div>
                    <div className="text-2xl font-bold">{l.total}</div>
                    <div className="text-xs text-gray-500 mt-1">{l.successRate}% success | ${l.cost.toFixed(2)} cost</div>
                  </div>
                );
              })}
            </div>
            <h2 className="text-lg font-semibold">Recent Evaluations</h2>
            {evalHistory.length === 0 ? <div className="text-gray-500 bg-gray-900 rounded-lg p-6 text-center">No eval runs yet.</div> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-gray-800"><th className="pb-2 pr-4">Agent</th><th className="pb-2 pr-4">Score</th><th className="pb-2 pr-4">Tests</th><th className="pb-2 pr-4">Status</th><th className="pb-2">When</th></tr></thead>
                <tbody>{evalHistory.slice(0, 10).map((e, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-2 pr-4 font-mono text-xs text-blue-400">{e.agentId.split(".").pop()}</td>
                    <td className="py-2 pr-4"><span className={"px-2 py-0.5 rounded text-xs font-medium " + (e.score && e.score >= 70 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>{e.score != null ? e.score + "%" : "N/A"}</span></td>
                    <td className="py-2 pr-4">{e.passedTests}/{e.totalTests}</td>
                    <td className="py-2 pr-4">{e.passed ? <span className="text-emerald-400">PASS</span> : <span className="text-red-400">FAIL</span>}</td>
                    <td className="py-2 text-xs text-gray-500">{new Date(e.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        )}

        {/* TRACES */}
        {tab === "traces" && !selectedTrace && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Traces</h2>
              <button onClick={loadTraces} className="px-3 py-1.5 bg-gray-800 rounded text-sm hover:bg-gray-700">Refresh</button>
            </div>
            {traces.length === 0 ? <div className="text-gray-500 bg-gray-900 rounded-lg p-6 text-center">No traces yet.</div> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-gray-800"><th className="pb-2 pr-4">Trace ID</th><th className="pb-2 pr-4">Origin</th><th className="pb-2 pr-4">Status</th><th className="pb-2 pr-4">Started</th><th className="pb-2 pr-4">Duration</th></tr></thead>
                <tbody>{traces.map((t, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/50 cursor-pointer" onClick={() => loadTraceDetail(t.id)}>
                    <td className="py-2 pr-4 font-mono text-xs">{t.id.substring(0, 12)}...</td>
                    <td className="py-2 pr-4 text-xs">{t.originType}</td>
                    <td className="py-2 pr-4"><span className={"px-2 py-0.5 rounded text-xs " + (t.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : t.status === "failed" ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400")}>{t.status}</span></td>
                    <td className="py-2 pr-4 text-xs text-gray-500">{new Date(t.startedAt).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-xs">{t.endedAt ? Math.round((new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime()) / 1000) + "s" : "..."}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        )}

        {/* TRACE DETAIL */}
        {tab === "traces" && selectedTrace && (
          <div>
            <button onClick={() => setSelectedTrace(null)} className="text-blue-400 text-sm mb-4 hover:underline">Back to traces</button>
            <div className="flex items-center gap-3 mb-4">
              <span className={"px-3 py-1 rounded-lg text-sm font-medium " + (selectedTrace.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>{selectedTrace.status}</span>
              <span className="text-xs text-gray-500">{selectedTrace.originType}</span>
            </div>
            <h2 className="text-sm font-medium text-gray-400 mb-3">Span Waterfall ({selectedTrace.spans.length} spans)</h2>
            <div className="space-y-1">
              {selectedTrace.spans.map((s, i) => {
                const dur = s.startedAt && s.endedAt ? new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime() : 0;
                const indent = s.spanType === "tool_call" ? "ml-6" : "";
                return (
                  <div key={i} className={"flex items-center gap-3 px-3 py-2 rounded " + indent}>
                    <span className={"w-2 h-2 rounded-full shrink-0 " + (s.status === "success" ? "bg-emerald-400" : s.status === "failure" ? "bg-red-400" : "bg-amber-400")}></span>
                    <span className={"px-2 py-0.5 rounded text-xs border " + (spanTypeColors[s.spanType] || "bg-gray-800 text-gray-400 border-gray-700")}>{spanTypeLabels[s.spanType] || s.spanType}</span>
                    {s.agentId && <span className="text-xs text-gray-600">{s.agentId.split(".").pop()}</span>}
                    {s.outputSummary && <span className="text-xs text-gray-400 truncate max-w-xs">{s.outputSummary.substring(0, 80)}</span>}
                    {s.error && <span className="text-xs text-red-400">{s.error}</span>}
                    {s.tokensUsed && <span className="text-xs text-gray-600 ml-auto">{s.tokensUsed} tok</span>}
                    <span className="text-xs text-gray-600">{dur}ms</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* COST */}
        {tab === "cost" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Cost by Layer (7 days)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {layerMetrics.map((l, i) => (
                <div key={i} className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                  <div className="text-xs text-gray-500 mb-1">{l.layer}</div>
                  <div className="text-xl font-bold">${l.cost.toFixed(2)}</div>
                  <div className="text-xs text-gray-600 mt-1">{l.tokens.toLocaleString()} tokens across {l.total} spans</div>
                </div>
              ))}
            </div>
            <h2 className="text-lg font-semibold">Cost by Agent</h2>
            {leaderboard.length === 0 ? <div className="text-gray-500">No data</div> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-gray-800"><th className="pb-2 pr-4">Agent</th><th className="pb-2 pr-4">Weekly Cost</th><th className="pb-2 pr-4">Tasks</th><th className="pb-2 pr-4">Failures</th><th className="pb-2">Reliability</th></tr></thead>
                <tbody>{leaderboard.map((e, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-2 pr-4 font-mono text-xs text-blue-400">{e.agentId.split(".").pop()}</td>
                    <td className="py-2 pr-4">${e.weeklyCost.toFixed(2)}</td>
                    <td className="py-2 pr-4">{e.totalTasks}</td>
                    <td className="py-2 pr-4 text-red-400">{e.failures}</td>
                    <td className="py-2"><span className={"px-2 py-0.5 rounded text-xs font-medium " + (e.reliability >= 80 ? "bg-emerald-500/20 text-emerald-400" : e.reliability >= 50 ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400")}>{e.reliability}%</span></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        )}

        {/* LEADERBOARD */}
        {tab === "leaderboard" && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Agent Leaderboard (7 days)</h2>
            {leaderboard.length === 0 ? <div className="text-gray-500 bg-gray-900 rounded-lg p-6 text-center">No data yet.</div> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-gray-800"><th className="pb-2 pr-4">#</th><th className="pb-2 pr-4">Agent</th><th className="pb-2 pr-4">Reliability</th><th className="pb-2 pr-4">Weekly Cost</th><th className="pb-2 pr-4">Tasks</th><th className="pb-2 pr-4">Failures</th><th className="pb-2">Escalation</th></tr></thead>
                <tbody>{leaderboard.map((e, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                    <td className="py-3 pr-4 text-gray-500">{i + 1}</td>
                    <td className="py-3 pr-4 font-mono text-xs text-blue-400">{e.agentId}</td>
                    <td className="py-3 pr-4"><span className={"px-2 py-0.5 rounded text-xs font-medium " + (e.reliability >= 90 ? "bg-emerald-500/20 text-emerald-400" : e.reliability >= 70 ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400")}>{e.reliability}%</span></td>
                    <td className="py-3 pr-4">${e.weeklyCost.toFixed(2)}</td>
                    <td className="py-3 pr-4">{e.totalTasks}</td>
                    <td className="py-3 pr-4 text-red-400">{e.failures}</td>
                    <td className="py-3">{e.escalationRate}%</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        )}

        {/* EVALS */}
        {tab === "evals" && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Evaluation Dashboard</h2>
            {evalHistory.length === 0 ? <div className="text-gray-500 bg-gray-900 rounded-lg p-6 text-center">No eval runs yet.</div> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-gray-800"><th className="pb-2 pr-4">Agent</th><th className="pb-2 pr-4">Score</th><th className="pb-2 pr-4">Passed</th><th className="pb-2 pr-4">Failed</th><th className="pb-2 pr-4">Trigger</th><th className="pb-2">Date</th></tr></thead>
                <tbody>{evalHistory.map((e, i) => (
                  <tr key={i} className={"border-b border-gray-800/50 " + (!e.passed ? "bg-red-500/5" : "")}>
                    <td className="py-3 pr-4 font-mono text-xs text-blue-400">{e.agentId}</td>
                    <td className="py-3 pr-4"><span className={"px-2 py-0.5 rounded text-xs font-bold " + (e.score != null && e.score >= 70 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>{e.score != null ? e.score + "%" : "N/A"}</span></td>
                    <td className="py-3 pr-4 text-emerald-400">{e.passedTests}</td>
                    <td className="py-3 pr-4 text-red-400">{e.failedTests}</td>
                    <td className="py-3 pr-4 text-xs text-gray-500">{e.triggeredBy}</td>
                    <td className="py-3 text-xs text-gray-500">{new Date(e.createdAt).toLocaleString()}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        )}

        {/* MEMORY */}
        {tab === "memory" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Founder Memory</h2>
              <div className="flex gap-2">
                {"".split("").length > -1 && ["", "founder_preference", "business_fact", "decision_log", "relationship_context", "strategic_goal", "constraint"].map(t => (
                  <button key={t || "all"} onClick={() => { setMemTypeFilter(t); loadMemories(t || undefined); }}
                    className={"px-2 py-1 rounded text-xs " + (memTypeFilter === t ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700")}>
                    {t ? t.replace("_", " ") : "All"}
                  </button>
                ))}
              </div>
            </div>
            {memories.length === 0 ? <div className="text-gray-500 bg-gray-900 rounded-lg p-6 text-center">No memories stored yet. Memories are created from founder statements, approval decisions, and agent pattern detection.</div> : (
              <div className="space-y-2">
                {memories.map((m, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={"px-2 py-0.5 rounded text-xs font-medium " + (memTypeColors[m.memoryType] || "bg-gray-800 text-gray-400")}>{m.memoryType.replace("_", " ")}</span>
                      {m.layer && <span className="px-2 py-0.5 rounded text-xs bg-gray-800 text-gray-400">{m.layer}</span>}
                      <span className={"text-xs " + (confidenceColors[m.confidence] || "text-gray-500")}>{m.confidence.replace("_", " ")}</span>
                      <span className="text-xs text-gray-600 ml-auto">Ref: {m.referenceCount}x</span>
                      {m.status === "superseded" && <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">superseded</span>}
                    </div>
                    <p className="text-sm text-gray-300">{m.content}</p>
                    <div className="text-xs text-gray-600 mt-2">{m.lastReferencedAt ? "Last used " + new Date(m.lastReferencedAt).toLocaleDateString() : "Never retrieved"} | Created {new Date(m.createdAt).toLocaleDateString()}</div>
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
