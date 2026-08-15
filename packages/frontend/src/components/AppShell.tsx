"use client";

import { useEffect } from 'react';
import ChatPane from './ChatPane';
import SidePanel from './SidePanel';
import AppHeader from './AppHeader';
import { useApprovalStore } from '@/stores/approvals.store';
import { useConnectorStore } from '@/stores/connectors.store';
import { useActivityStore } from '@/stores/activity.store';
import { useChatStore } from '@/stores/chat.store';
import { useState } from 'react';

export default function AppShell() {
  const [sideOpen, setSideOpen] = useState(true);
  const fetchApprovals = useApprovalStore((s) => s.fetchApprovals);
  const fetchConnectors = useConnectorStore((s) => s.fetchConnectors);
  const { startPolling, stopPolling } = useActivityStore();
  const loadHistory = useChatStore((s) => s.loadHistory);

  useEffect(() => {
    fetchApprovals();
    fetchConnectors();
    loadHistory();
    startPolling();
    return () => { stopPolling(); };
  }, [fetchApprovals, fetchConnectors, loadHistory, startPolling, stopPolling]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      <AppHeader onToggleSide={() => setSideOpen(!sideOpen)} sideOpen={sideOpen} />
      <div className="flex-1 flex overflow-hidden">
        <ChatPane />
        {sideOpen && <SidePanel onClose={() => setSideOpen(false)} />}
      </div>
    </div>
  );
}
