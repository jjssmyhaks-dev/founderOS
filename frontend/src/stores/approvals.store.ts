import { create } from 'zustand';

export interface Approval {
  id: string;
  taskId: string;
  agentId: string;
  layer: string;
  action: string;
  reasoning: string;
  riskTier: string;
  riskFactors: string[];
  status: string;
  createdAt: string;
  expiresAt: string;
}

interface ApprovalState {
  approvals: Approval[];
  unreadCount: number;
 fetchApprovals: () => Promise<void>;
  approve: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
  edit: (id: string, editedAction: string) => Promise<void>;
}

export const useApprovalStore = create<ApprovalState>((set, get) => ({
  approvals: [],
  unreadCount: 0,
  fetchApprovals: async () => {
    const token = localStorage.getItem('helm_token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:4000/api/approvals', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        set({ approvals: data, unreadCount: data.length });
      }
    } catch { /* silent */ }
  },
  approve: async (id) => {
    const token = localStorage.getItem('helm_token');
    if (!token) return;
    await fetch(`http://localhost:4000/api/approvals/${id}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    set((s) => ({ approvals: s.approvals.filter(a => a.id !== id), unreadCount: Math.max(0, s.unreadCount - 1) }));
  },
  reject: async (id) => {
    const token = localStorage.getItem('helm_token');
    if (!token) return;
    await fetch(`http://localhost:4000/api/approvals/${id}/reject`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    set((s) => ({ approvals: s.approvals.filter(a => a.id !== id), unreadCount: Math.max(0, s.unreadCount - 1) }));
  },
  edit: async (id, editedAction) => {
    const token = localStorage.getItem('helm_token');
    if (!token) return;
    await fetch(`http://localhost:4000/api/approvals/${id}/edit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ editedAction }),
    });
    set((s) => ({ approvals: s.approvals.filter(a => a.id !== id), unreadCount: Math.max(0, s.unreadCount - 1) }));
  },
}));
