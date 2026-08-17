"use client";

import { useEffect } from 'react';
import ChatPane from './ChatPane';
import SidePanel from './SidePanel';
import AppHeader from './AppHeader';
import { useApprovalStore } from '@/stores/approvals.store';
import { useConnectorStore } from '@/stores/connectors.store';
import { useChatStore } from '@/stores/chat.store';
import { useWebSocket } from '@/lib/websocket';
import { useState } from 'react';

export default function AppShell() {
  const [sideOpen, setSideOpen] = useState(true);
  const fetchApprovals = useApprovalStore((s) => s.fetchApprovals);
  const fetchConnectors = useConnectorStore((s) => s.fetchConnectors);
  const loadHistory = useChatStore((s) => s.loadHistory);

  // WebSocket for live updates (approvals, activity, events)
  useWebSocket((msg) => {
    console.log('[AppShell] WS event:', msg.type, msg.data);
  });

  useEffect(() => {
    fetchApprovals();
    fetchConnectors();
    loadHistory();
  }, [fetchApprovals, fetchConnectors, loadHistory]);

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