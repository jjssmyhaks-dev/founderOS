"use client";

import { useState, useEffect } from 'react';
import ActivityFeed from './sidepanel/ActivityFeed';
import ApprovalQueue from './sidepanel/ApprovalQueue';
import ConnectorPanel from './sidepanel/ConnectorPanel';
import ContextCompletenessBar from './sidepanel/ContextCompletenessBar';
import LoadingSpinner from './LoadingSpinner';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Props { onClose: () => void; }

export default function SidePanel({ onClose }: Props) {
  const [completeness, setCompleteness] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch('/onboarding/completeness')
      .then(r => r.ok ? r.json() : null)
      .then(setCompleteness)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-80 border-l border-[var(--border)] bg-[var(--bg-panel)] flex flex-col shrink-0 animate-slideIn">
      <div className="md:hidden flex justify-end p-2">
        <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
        {loading ? <LoadingSpinner message="Loading context..." /> : completeness && <ContextCompletenessBar data={completeness} />}
        <ApprovalQueue />
        <ActivityFeed />
        <ConnectorPanel />
      </div>
    </div>
  );
}
