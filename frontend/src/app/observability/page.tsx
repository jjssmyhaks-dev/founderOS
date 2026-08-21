'use client';
import { useState, useEffect } from 'react';
import { apiHeaders } from '@/lib/api';
import AuthGuard from '@/components/AuthGuard';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ArrowLeft, Activity, Brain, ChevronRight, Sparkles } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const obsFetch = (path: string, opts?: RequestInit) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('helm_token') : null;
  return fetch(API + path, { ...opts, headers: { ...apiHeaders(token), ...opts?.headers } });
};

interface Span { id: string; spanType: string; status: string; agentId: string | null; inputSummary: string | null; outputSummary: string | null; error: string | null; tokensUsed: number | null; startedAt: string; endedAt: string | null; }
interface Trace { id: string; originType: string; originRef: string | null; founderId: string; startedAt: string; endedAt: string | null; status: string; spans: Span[]; }
interface ActivityItem { id: string; agentId: string | null; type: string; description: string; timestamp: string; metadata?: any; }

const spanTypeLabels: Record<string, string> = { task: 'Task', reasoning_step: 'Reasoning', tool_call: 'Tool Call', handoff: 'Handoff', approval_wait: 'Approval Wait', event_publish: 'Event' };

export default function ObservabilityPage() {
  return (
    <ErrorBoundary>
      <AuthGuard>
        <ObservabilityContent />
      </AuthGuard>
    </ErrorBoundary>
  );
}

function ObservabilityContent() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => { obsFetch('/activity?limit=30').then(r => r.json()).then(d => setActivities(d.items || d || [])).catch(() => {}); }, []);

  const loadTrace = async (traceId: string) => { setSelectedTraceId(traceId); const r = await obsFetch('/observability/traces/' + traceId); setTrace(await r.json()); setExplanation(null); };

  const explainTrace = () => {
    if (!trace) return;
    const steps = trace.spans.map(s => {
      const dur = s.startedAt && s.endedAt ? Math.round((new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 1000) : 0;
      return '- ' + (spanTypeLabels[s.spanType] || s.spanType) + ' by ' + (s.agentId || 'system') + ': ' + (s.outputSummary || s.inputSummary || (s.error || 'no output')) + ' (' + dur + 's)';
    }).join('\n');
    setExplanation('This trace started as a ' + trace.originType + '. Here is what happened:\n\n' + steps);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
          <a href="/" className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-tertiary)] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div>
            <h1 className="text-sm font-semibold text-white">Activity & Traces</h1>
            <p className="text-[10px] text-[var(--text-muted)]">See what Helm has been doing and why</p>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)]">
        {/* Activity sidebar */}
        <div className="w-80 border-r border-[var(--border)] bg-[var(--bg-secondary)]/40 overflow-y-auto shrink-0">
          <div className="p-3 space-y-0.5">
            {activities.map((a, i) => (
              <button key={i} onClick={() => a.metadata?.traceId && loadTrace(a.metadata.traceId)}
                className={"w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all " + (selectedTraceId === a.metadata?.traceId ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20' : 'hover:bg-[var(--bg-tertiary)] border border-transparent')}>
                <div className="flex items-center gap-2">
                  <span className={"w-2 h-2 rounded-full shrink-0 " + (a.type?.includes('ERROR') || a.type?.includes('ALERT') ? 'bg-red-400' : a.type?.includes('TASK') ? 'bg-blue-400' : a.type?.includes('APPROVAL') ? 'bg-amber-400' : 'bg-[var(--text-muted)]')}></span>
                  <span className="truncate text-[var(--text-secondary)] text-xs">{a.description}</span>
                </div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5 ml-4">{a.agentId ? a.agentId.split('.').pop() : 'system'}</div>
              </button>
            ))}
            {activities.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Activity className="w-8 h-8 text-[var(--text-muted)] mb-3 opacity-50" />
                <p className="text-sm text-[var(--text-muted)]">No activity yet</p>
                <p className="text-xs text-[var(--text-muted)] mt-1 opacity-60">Send a message to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Main trace view */}
        <div className="flex-1 overflow-y-auto">
          {!trace && (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
              <div className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center mb-4">
                <Brain className="w-8 h-8 opacity-40" />
              </div>
              <p className="text-sm">Select an activity to view its trace</p>
            </div>
          )}
          {trace && (
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <span className={"px-3 py-1 rounded-lg text-xs font-medium " + (trace.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' : trace.status === 'failed' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400')}>{trace.status}</span>
                <span className="text-xs text-[var(--text-muted)]">{trace.originType}</span>
                <button onClick={explainTrace} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 rounded-lg text-xs font-medium transition-colors">
                  <Sparkles className="w-3 h-3" /> Why did you do that?
                </button>
              </div>

              {explanation && (
                <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
                  <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Explanation</h3>
                  <p className="text-sm text-[var(--text-primary)] whitespace-pre-line leading-relaxed">{explanation}</p>
                </div>
              )}

              <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Span Waterfall ({trace.spans.length} steps)</h3>
              <div className="space-y-1">
                {trace.spans.map((s, i) => {
                  const dur = s.startedAt && s.endedAt ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime())) : 0;
                  return (
                    <div key={i} className={"flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-[var(--bg-tertiary)]/50 transition-colors " + (s.spanType === 'tool_call' ? 'ml-8' : s.spanType === 'handoff' ? 'ml-4' : '')}>
                      <span className={"w-2 h-2 rounded-full shrink-0 " + (s.status === 'success' ? 'bg-emerald-400' : s.status === 'failure' ? 'bg-red-400' : 'bg-amber-400')}></span>
                      <span className={"px-2 py-0.5 rounded text-xs font-medium border " + (s.spanType === 'tool_call' ? 'bg-amber-500/15 text-amber-400 border-amber-500/25' : s.spanType === 'reasoning_step' ? 'bg-blue-500/15 text-blue-400 border-blue-500/25' : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border)]')}>{spanTypeLabels[s.spanType] || s.spanType}</span>
                      {s.agentId && <span className="text-xs text-[var(--text-muted)] font-mono">{s.agentId.split('.').pop()}</span>}
                      {s.outputSummary && <span className="text-xs text-[var(--text-secondary)] truncate max-w-md">{s.outputSummary}</span>}
                      {s.error && <span className="text-xs text-red-400">{s.error}</span>}
                      <span className="text-xs text-[var(--text-muted)] ml-auto whitespace-nowrap">{dur}ms</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
