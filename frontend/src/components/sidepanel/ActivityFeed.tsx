'use client';

import { useActivityStore } from '@/stores/activity.store';
import { AGENTS, getLayerConfig } from '@/config/agents';
import { Activity, Sparkles } from 'lucide-react';

export default function ActivityFeed() {
  const activities = useActivityStore((s) => s.activities);

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
          <Activity className="w-6 h-6 text-[var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">No activity yet</p>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-[200px]">
          Send your first message in the chat and Helm&apos;s agents will start working. You&apos;ll see their progress here.
        </p>
        <div className="mt-4 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <Sparkles className="w-3 h-3" />
          <span>21 agents ready</span>
        </div>
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