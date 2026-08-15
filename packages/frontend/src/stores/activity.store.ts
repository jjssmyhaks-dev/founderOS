import { create } from 'zustand';

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
    const token = localStorage.getItem('helm_token');
    if (!token) return;
    try {
      const res = await fetch('http://localhost:4000/api/agents/activity', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) set({ activities: await res.json() });
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
