"use client";

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import ActivityFeed from './sidepanel/ActivityFeed';
import ApprovalQueue from './sidepanel/ApprovalQueue';
import ConnectorPanel from './sidepanel/ConnectorPanel';
import ContextCompletenessBar from './sidepanel/ContextCompletenessBar';
import { X } from 'lucide-react';

interface Props { onClose: () => void; }

export default function SidePanel({ onClose }: Props) {
  const [completeness, setCompleteness] = useState<any>(null);

  useEffect(() => {
    apiFetch('/onboarding/completeness')
      .then(r => r.ok ? r.json() : null)
      .then(setCompleteness)
      .catch(() => {});
  }, []);

  return (
    <div className="w-80 border-l border-[var(--border)] bg-[var(--bg-panel)] flex flex-col shrink-0 animate-slideIn">
      {/* Mobile close button */}
      <div className="md:hidden flex justify-end p-2">
        <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Context Completeness */}
      <div className="p-2 border-b border-[var(--border)]">
        <ContextCompletenessBar data={completeness} />
      </div>

      {/* Activity Feed */}
      <div className="flex-1 min-h-0 border-b border-[var(--border)] flex flex-col">
        <PanelSectionHeader label="Agent Activity" />
        <div className="flex-1 overflow-y-auto">
          <ActivityFeed />
        </div>
      </div>

      {/* Approval Queue */}
      <div className="flex-1 min-h-0 border-b border-[var(--border)] flex flex-col">
        <PanelSectionHeader label="Approvals" />
        <div className="flex-1 overflow-y-auto">
          <ApprovalQueue />
        </div>
      </div>

      {/* Connectors */}
      <div className="flex-1 min-h-0 flex flex-col">
        <PanelSectionHeader label="Connectors" />
        <div className="flex-1 overflow-y-auto">
          <ConnectorPanel />
        </div>
      </div>
    </div>
  );
}

function PanelSectionHeader({ label }: { label: string }) {
  return (
    <div className="px-3 py-2.5 border-b border-[var(--border)]">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</h3>
    </div>
  );
}