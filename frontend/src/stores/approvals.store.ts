import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

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
    try {
      const res = await apiFetch('/approvals');
      if (res.ok) {
        const data = await res.json();
        set({ approvals: data, unreadCount: data.length });
      }
    } catch { /* silent */ }
  },
  approve: async (id) => {
    try {
      await apiFetch(`/approvals/${id}/approve`, { method: 'POST' });
      set((s) => ({ approvals: s.approvals.filter(a => a.id !== id), unreadCount: Math.max(0, s.unreadCount - 1) }));
    } catch (e) { console.error('Approve failed:', e); }
  },
  reject: async (id) => {
    try {
      await apiFetch(`/approvals/${id}/reject`, { method: 'POST' });
      set((s) => ({ approvals: s.approvals.filter(a => a.id !== id), unreadCount: Math.max(0, s.unreadCount - 1) }));
    } catch (e) { console.error('Reject failed:', e); }
  },
  edit: async (id, editedAction) => {
    try {
      await apiFetch(`/approvals/${id}/edit`, {
        method: 'POST',
        body: JSON.stringify({ editedAction }),
      });
      set((s) => ({ approvals: s.approvals.filter(a => a.id !== id), unreadCount: Math.max(0, s.unreadCount - 1) }));
    } catch (e) { console.error('Edit failed:', e); }
  },
}));
