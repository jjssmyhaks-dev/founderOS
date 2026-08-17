import { useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '@/lib/api';
import { useApprovalStore } from '@/stores/approvals.store';
import { useActivityStore } from '@/stores/activity.store';

interface WSMessage {
  type: string;
  data: any;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let listeners: Set<(msg: WSMessage) => void> = new Set();

function getWSUrl(): string {
  const token = localStorage.getItem('helm_token');
  const base = WS_URL || 'ws://localhost:3001';
  return `${base}?token=${token}`;
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
   
  const url = getWSUrl();
  try {
    ws = new WebSocket(url);
  } catch {
    // WebSocket not available (SSR)
    return;
  }

  ws.onopen = () => {
    console.log('[WS] Connected');
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };

  ws.onmessage = (event) => {
    try {
      const msg: WSMessage = JSON.parse(event.data);
      listeners.forEach(fn => fn(msg));
      
      // Auto-handle known message types
      if (msg.type === 'approval:new' || msg.type === 'approval:update') {
        useApprovalStore.getState().fetchApprovals();
      }
      if (msg.type === 'activity:new') {
        useActivityStore.getState().fetchActivities();
      }
    } catch (err) {
      console.error('[WS] Parse error:', err);
    }
  };

  ws.onclose = () => {
    console.log('[WS] Disconnected, reconnecting in 3s...');
    reconnectTimer = setTimeout(() => connect(), 3000);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function disconnect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.close(); ws = null; }
  listeners.clear();
}

export function useWebSocket(onMessage?: (msg: WSMessage) => void) {
  const stableCallback = useCallback(onMessage || (() => {}), [onMessage]);
  const ref = useRef(stableCallback);
  ref.current = stableCallback;

  useEffect(() => {
    if (!localStorage.getItem('helm_token')) return;
    
    connect();
    const handler = (msg: WSMessage) => ref.current(msg);
    listeners.add(handler);
    
    // Start polling approvals and activity on connect
    useApprovalStore.getState().fetchApprovals();
    useActivityStore.getState().startPolling();

    return () => {
      listeners.delete(handler);
      useActivityStore.getState().stopPolling();
      disconnect();
    };
  }, []);
}

export { connect as wsConnect, disconnect as wsDisconnect };