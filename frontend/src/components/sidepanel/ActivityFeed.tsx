'use client';

import { useActivityStore } from '@/stores/activity.store';
import { AGENTS, getLayerConfig } from '@/config/agents';
import { Activity } from 'lucide-react';

export default function ActivityFeed() {
  const activities = useActivityStore((s) => s.activities);

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <Activity className="w-8 h-8 text-[var(--text-muted)] mb-2" />
        <p className="text-xs text-[var(--text-muted)]">All agents idle</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {activities.map((a) => {
        const agent = AGENTS.find(ag => ag.id === a.agentId);
        const layerCfg = a.layer ? getLayerConfig(a.layer) : null;
        return (
          <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
            <span className="text-sm mt-0.5">{agent?.emoji || '🤖'}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-[var(--text-primary)] truncate">
                  {a.agentName || agent?.name || a.agentId || 'System'}
                </span>
                {layerCfg && (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0`} style={{ backgroundColor: layerCfg.color }} />
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{a.description}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}