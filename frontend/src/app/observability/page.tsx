'use client';
import { useState, useEffect } from 'react';
import { apiHeaders } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const obsFetch = (path: string, opts?: RequestInit) => {
  return fetch(API + path, { ...opts, headers: { ...apiHeaders(), ...opts?.headers } });
};

interface Span {
  id: string; spanType: string; status: string;
  agentId: string | null; inputSummary: string | null;
  outputSummary: string | null; error: string | null;
  tokensUsed: number | null; costEstimate: number | null;
  startedAt: string; endedAt: string | null;
}

interface Trace {
  id: string; originType: string; originRef: string | null;
  founderId: string; startedAt: string; endedAt: string | null;
  status: string; spans: Span[];
}

interface ActivityItem {
  id: string; agentId: string | null; type: string;
  description: string; timestamp: string; metadata?: any;
}

const spanTypeLabels: Record<string, string> = {
  task: 'Task', reasoning_step: 'Reasoning', tool_call: 'Tool Call',
  handoff: 'Handoff', approval_wait: 'Approval Wait', event_publish: 'Event',
};

export default function ObservabilityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => {
    obsFetch('/activity?limit=30').then(r => r.json()).then(d => setActivities(d.items || d || [])).catch(() => {});
  }, []);

  const loadTrace = async (traceId: string) => {
    setSelectedTraceId(traceId);
    const r = await obsFetch('/observability/traces/' + traceId);
    setTrace(await r.json());
    setExplanation(null);
  };

  const explainTrace = () => {
    if (!trace) return;
    const steps = trace.spans.map(s => {
      const dur = s.startedAt && s.endedAt ? Math.round((new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 1000) : 0;
      return '- ' + (spanTypeLabels[s.spanType] || s.spanType) + ' by ' + (s.agentId || 'system') + ': ' + (s.outputSummary || s.inputSummary || (s.error || 'no output')) + ' (' + dur + 's)';
    }).join(String.fromCharCode(10));
    setExplanation('This trace started as a ' + trace.originType + '. Here is what happened:' + String.fromCharCode(10) + String.fromCharCode(10) + steps);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold">Activity & Traces</h1>
        <p className="text-sm text-gray-500 mt-1">See what Helm has been doing and why</p>
      </header>
      <div className="flex">
        {/* Activity Feed */}
        <div className="w-80 border-r border-gray-800 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 73px)' }}>
          <div className="p-3 space-y-1">
            {activities.map((a, i) => (
              <button key={i} onClick={() => a.metadata?.traceId && loadTrace(a.metadata.traceId)}
                className={"w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-800 transition-colors " + (selectedTraceId === a.metadata?.traceId ? 'bg-gray-800' : '')}>
                <div className="flex items-center gap-2">
                  <span className={"w-2 h-2 rounded-full shrink-0 " + (a.type?.includes('ERROR') || a.type?.includes('ALERT') ? 'bg-red-400' : a.type?.includes('TASK') ? 'bg-blue-400' : a.type?.includes('APPROVAL') ? 'bg-amber-400' : 'bg-gray-500')}></span>
                  <span className="truncate text-gray-300 text-xs">{a.description}</span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5 ml-4">{a.agentId ? a.agentId.split('.').pop() : 'system'} · {new Date(a.timestamp).toLocaleTimeString()}</div>
              </button>
            ))}
            {activities.length === 0 && <div className="text-gray-600 text-center py-8 text-sm">No activity yet</div>}
          </div>
        </div>

        {/* Trace Detail */}
        <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 73px)' }}>
          {!trace && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <div className="text-4xl mb-3">🔍</div>
              <p>Select an activity to view its trace</p>
              <p className="text-sm mt-1">Only actions with traces will expand</p>
            </div>
          )}
          {trace && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={"px-3 py-1 rounded-lg text-sm font-medium " + (trace.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : trace.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}>{trace.status}</span>
                <span className="text-xs text-gray-500">{trace.originType}</span>
                <span className="font-mono text-xs text-gray-600">{trace.id.substring(0, 16)}...</span>
                {trace.endedAt && <span className="text-xs text-gray-500">{Math.round((new Date(trace.endedAt).getTime() - new Date(trace.startedAt).getTime()) / 1000)}s</span>}
                <button onClick={explainTrace} className="ml-auto px-3 py-1.5 bg-blue-600 rounded-lg text-sm hover:bg-blue-500">Why did you do that?</button>
              </div>

              {/* Plain Language Explanation */}
              {explanation && (
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Explanation</h3>
                  <p className="text-sm text-gray-300 whitespace-pre-line">{explanation}</p>
                </div>
              )}

              {/* Span Waterfall */}
              <h3 className="text-sm font-medium text-gray-400">Span Waterfall ({trace.spans.length} steps)</h3>
              <div className="space-y-1">
                {trace.spans.map((s, i) => {
                  const dur = s.startedAt && s.endedAt ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime())) : 0;
                  const indent = s.spanType === 'tool_call' ? 'ml-8' : s.spanType === 'handoff' ? 'ml-4' : '';
                  return (
                    <div key={i} className={"flex items-center gap-3 px-3 py-2 rounded-lg " + indent}>
                      <span className={"w-2 h-2 rounded-full shrink-0 " + (s.status === 'success' ? 'bg-emerald-400' : s.status === 'failure' ? 'bg-red-400' : 'bg-amber-400')}></span>
                      <span className={"px-2 py-0.5 rounded text-xs font-medium " + (s.spanType === 'tool_call' ? 'bg-amber-500/20 text-amber-400' : s.spanType === 'reasoning_step' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-400')}>{spanTypeLabels[s.spanType] || s.spanType}</span>
                      {s.agentId && <span className="text-xs text-gray-500 font-mono">{s.agentId.split('.').pop()}</span>}
                      {s.outputSummary && <span className="text-xs text-gray-400 truncate max-w-md">{s.outputSummary}</span>}
                      {s.error && <span className="text-xs text-red-400">{s.error}</span>}
                      <span className="text-xs text-gray-600 ml-auto whitespace-nowrap">{dur}ms</span>
                      {s.tokensUsed && <span className="text-xs text-gray-600">{s.tokensUsed}tok</span>}
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
