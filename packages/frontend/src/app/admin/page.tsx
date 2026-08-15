'use client';
import { useState, useEffect } from 'react';

interface AgentStats {
  agentId: string;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  approvalPending: number;
  avgStepsPerTask: number;
  avgDurationMs: number;
}

interface ConnectorHealth {
  name: string;
  status: string;
  lastHealthCheck: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AgentStats[]>([]);
  const [connectors, setConnectors] = useState<ConnectorHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'agents' | 'connectors' | 'triggers'>('agents');

  useEffect(() => {
    Promise.all([
      fetch(API + '/agent-runtime/stats').then(r => r.json()).catch(() => []),
      fetch(API + '/connectors').then(r => r.json()).catch(() => []),
    ]).then(([s, c]) => {
      setStats(s.agents || s || []);
      setConnectors(Array.isArray(c) ? c : c.connectors || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Agent performance, connector health, and system observability</p>
      </header>

      <div className="px-6 py-4 flex gap-2 border-b border-gray-800">
        {(['agents', 'connectors', 'triggers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={"px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors " + (tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === 'agents' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Agent Performance</h2>
            {stats.length === 0 ? (
              <div className="text-gray-500 bg-gray-900 rounded-lg p-8 text-center">No task data yet. Run some agent tasks to see stats here.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500 border-b border-gray-800">
                    <th className="pb-3 pr-4">Agent</th>
                    <th className="pb-3 pr-4">Total</th>
                    <th className="pb-3 pr-4">Completed</th>
                    <th className="pb-3 pr-4">Failed</th>
                    <th className="pb-3 pr-4">Approval</th>
                    <th className="pb-3 pr-4">Avg Steps</th>
                    <th className="pb-3 pr-4">Avg Duration</th>
                    <th className="pb-3">Success Rate</th>
                  </tr></thead>
                  <tbody>{stats.map((s, i) => {
                    const rate = s.totalTasks > 0 ? Math.round((s.completedTasks / s.totalTasks) * 100) : 0;
                    return (<tr key={i} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                      <td className="py-3 pr-4 font-mono text-xs text-blue-400">{s.agentId.split('.').pop()}</td>
                      <td className="py-3 pr-4">{s.totalTasks}</td>
                      <td className="py-3 pr-4 text-emerald-400">{s.completedTasks}</td>
                      <td className="py-3 pr-4 text-red-400">{s.failedTasks}</td>
                      <td className="py-3 pr-4 text-amber-400">{s.approvalPending}</td>
                      <td className="py-3 pr-4">{s.avgStepsPerTask.toFixed(1)}</td>
                      <td className="py-3 pr-4">{(s.avgDurationMs / 1000).toFixed(1)}s</td>
                      <td className="py-3"><span className={"px-2 py-0.5 rounded text-xs font-medium " + (rate >= 80 ? 'bg-emerald-500/20 text-emerald-400' : rate >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400')}>{rate}%</span></td>
                    </tr>);
                  })}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'connectors' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Connector Health</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectors.length === 0 ? (
                <div className="text-gray-500 bg-gray-900 rounded-lg p-8 text-center col-span-full">No connectors configured.</div>
              ) : connectors.map((c, i) => (
                <div key={i} className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={"w-2.5 h-2.5 rounded-full " + (c.status === 'CONNECTED' ? 'bg-emerald-400' : 'bg-red-400')} />
                    <span className="font-medium">{c.name}</span>
                  </div>
                  <div className="text-xs text-gray-500">Status: {c.status}</div>
                  {c.lastHealthCheck && <div className="text-xs text-gray-600 mt-1">Last check: {new Date(c.lastHealthCheck).toLocaleString()}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'triggers' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Scheduled Triggers</h2>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div><div className="font-medium">Daily Competitor Scan</div><div className="text-xs text-gray-500">research.competitor_intel</div></div>
                  <div className="text-right"><div className="text-xs font-mono text-blue-400">0 9 * * 1-5</div><div className="text-xs text-gray-500">Mon-Fri 9:00 AM</div></div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div><div className="font-medium">Weekly Content Review</div><div className="text-xs text-gray-500">marketing.performance_marketer</div></div>
                  <div className="text-right"><div className="text-xs font-mono text-blue-400">0 10 * * 0</div><div className="text-xs text-gray-500">Sunday 10:00 AM</div></div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div><div className="font-medium">Daily Cashflow Check</div><div className="text-xs text-gray-500">finance.bookkeeper</div></div>
                  <div className="text-right"><div className="text-xs font-mono text-blue-400">0 8 * * 1-6</div><div className="text-xs text-gray-500">Mon-Sat 8:00 AM</div></div>
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-4">Triggers execute via the AgentRuntimeService. Production deployment should use @nestjs/schedule for cron-based firing.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
