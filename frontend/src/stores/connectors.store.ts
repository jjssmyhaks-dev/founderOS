import { create } from 'zustand';

export interface Connector {
  id: string;
  connectorName: string;
  displayName: string;
  icon: string;
  status: 'CONNECTED' | 'NEEDS_REAUTH' | 'DISCONNECTED' | 'ERROR';
  layer: string;
  description: string;
  lastHealthCheck?: string;
}

interface ConnectorState {
  connectors: Connector[];
  connectingId: string | null;
  fetchConnectors: () => Promise<void>;
  connect: (name: string) => Promise<void>;
  disconnect: (name: string) => Promise<void>;
}

export const useConnectorStore = create<ConnectorState>((set) => ({
  connectors: [],
  connectingId: null,
  fetchConnectors: async () => {
    const token = localStorage.getItem('helm_token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:4000/api/connectors', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) set({ connectors: await res.json() });
    } catch { /* silent */ }
  },
  connect: async (name) => {
    const token = localStorage.getItem('helm_token');
    if (!token) return;
    set({ connectingId: name });
    try {
      await fetch(`http://localhost:4000/api/connectors/${name}/connect`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      set(s => ({ connectors: s.connectors.map(c => c.connectorName === name ? { ...c, status: 'CONNECTED' as const } : c), connectingId: null }));
    } catch { set({ connectingId: null }); }
  },
  disconnect: async (name) => {
    const token = localStorage.getItem('helm_token');
    if (!token) return;
    await fetch(`http://localhost:4000/api/connectors/${name}/disconnect`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    set(s => ({ connectors: s.connectors.map(c => c.connectorName === name ? { ...c, status: 'DISCONNECTED' as const } : c) }));
  },
}));
