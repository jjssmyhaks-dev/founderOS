"use client";

import { useEffect, useState } from 'react';
import ChatPane from './ChatPane';
import SidePanel from './SidePanel';
import AppHeader from './AppHeader';
import { useApprovalStore } from '@/stores/approvals.store';
import { useConnectorStore } from '@/stores/connectors.store';
import { useChatStore } from '@/stores/chat.store';
import { useWebSocket } from '@/lib/websocket';

export default function AppShell() {
  const [sideOpen, setSideOpen] = useState(false);
  const fetchApprovals = useApprovalStore((s) => s.fetchApprovals);
  const fetchConnectors = useConnectorStore((s) => s.fetchConnectors);
  const loadHistory = useChatStore((s) => s.loadHistory);

  // WebSocket for live updates
  useWebSocket((msg) => {
    console.log('[AppShell] WS:', msg.type);
  });

  useEffect(() => {
    fetchApprovals();
    fetchConnectors();
    loadHistory();
  }, [fetchApprovals, fetchConnectors, loadHistory]);

  // Close side panel on small screens by default
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    if (mq.matches) setSideOpen(false);
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setSideOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-primary)]">
      <AppHeader onToggleSide={() => setSideOpen(!sideOpen)} sideOpen={sideOpen} />
      <div className="flex-1 flex overflow-hidden relative">
        <ChatPane />
        {sideOpen && <SidePanel onClose={() => setSideOpen(false)} />}
      </div>
    </div>
  );
}
