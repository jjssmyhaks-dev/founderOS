import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

export interface Activity {
  id: string;
  agentId?: string;
  agentName?: string;
  type: string;
  description: string;
  layer?: string;
  timestamp: string;
}

interface ActivityState {
  activities: Activity[];
  isPolling: boolean;
  fetchActivities: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
}

let pollInterval: ReturnType<typeof setInterval> | null = null;

export const useActivityStore = create<ActivityState>((set) => ({
  activities: [],
  isPolling: false,
  fetchActivities: async () => {
    try {
      const res = await apiFetch('/activity?limit=30');
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        set({ activities: items });
      }
    } catch { /* silent */ }
  },
  startPolling: () => {
    if (pollInterval) return;
    set({ isPolling: true });
    pollInterval = setInterval(async () => {
      const { fetchActivities } = useActivityStore.getState();
      await fetchActivities();
    }, 5000);
  },
  stopPolling: () => {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    set({ isPolling: false });
  },
}));
