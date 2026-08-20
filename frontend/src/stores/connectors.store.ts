import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

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
    try {
      const res = await apiFetch('/connectors');
      if (res.ok) {
        const data = await res.json();
        // Backend returns {items: [...], total, limit, offset} for registry
        const list = Array.isArray(data) ? data : (data.items || data);
        // The registry endpoint returns definitions with a `connection` field
        const connectors = (Array.isArray(list) ? list : []).map((c: any) => ({
          id: c.connection?.id || c.id || c.name,
          connectorName: c.name,
          displayName: c.displayName || c.name,
          icon: c.icon || '🔌',
          status: c.connection?.status || 'DISCONNECTED',
          layer: c.layer || 'CROSS_LAYER',
          description: c.description || '',
          lastHealthCheck: c.connection?.lastHealthCheck,
        }));
        set({ connectors });
      }
    } catch { /* silent */ }
  },
  connect: async (name) => {
    set({ connectingId: name });
    try {
      await apiFetch(`/connectors/${name}/connect`, { method: 'POST' });
      set(s => ({ connectors: s.connectors.map(c => c.connectorName === name ? { ...c, status: 'CONNECTED' as const } : c), connectingId: null }));
    } catch { set({ connectingId: null }); }
  },
  disconnect: async (name) => {
    try {
      await apiFetch(`/connectors/${name}/disconnect`, { method: 'DELETE' });
      set(s => ({ connectors: s.connectors.map(c => c.connectorName === name ? { ...c, status: 'DISCONNECTED' as const } : c) }));
    } catch { /* silent */ }
  },
}));
