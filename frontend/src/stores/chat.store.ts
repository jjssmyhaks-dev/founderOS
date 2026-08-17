import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

export interface ChatMsg {
  id: string;
  sessionId: string;
  role: 'FOUNDER' | 'AGENT' | 'SYSTEM';
  content: string;
  agentId?: string;
  layer?: string;
  createdAt: string;
  metadata?: { onboarding?: boolean; isOnboarding?: boolean };
}

interface ChatState {
  messages: ChatMsg[];
  currentSessionId: string | null;
  isLoading: boolean;
  isRecording: boolean;
  isOnboarding: boolean;
  sendMessage: (content: string) => Promise<void>;
  addMessage: (msg: ChatMsg) => void;
  setSession: (id: string) => void;
  setLoading: (v: boolean) => void;
  setRecording: (v: boolean) => void;
  setOnboarding: (v: boolean) => void;
  loadHistory: () => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentSessionId: null,
  isLoading: false,
  isRecording: false,
  isOnboarding: false,

  sendMessage: async (content: string) => {
    const token = localStorage.getItem('helm_token');
    if (!token) return;
    const optimistic: ChatMsg = { id: `tmp-${Date.now()}`, sessionId: get().currentSessionId || '', role: 'FOUNDER', content, createdAt: new Date().toISOString() };
    set(s => ({ messages: [...s.messages, optimistic], isLoading: true }));
    try {
      const res = await apiFetch('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ content, sessionId: get().currentSessionId }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      const data = await res.json();
      const agentMsg: ChatMsg = {
        id: data.response?.id || `resp-${Date.now()}`,
        sessionId: data.sessionId || get().currentSessionId || '',
        role: 'AGENT',
        content: data.response?.content || 'No response',
        agentId: data.response?.agentId,
        layer: data.response?.layer,
        createdAt: new Date().toISOString(),
        metadata: data.response?.metadata,
      };
      const updatedOnboarding = data.isOnboarding !== undefined ? !data.isOnboarding : get().isOnboarding;
      set(s => ({
        messages: [
          ...s.messages.filter(m => m.id !== optimistic.id),
          { ...optimistic, id: data.message?.id || optimistic.id },
          agentMsg,
        ],
        currentSessionId: data.sessionId || s.currentSessionId,
        isLoading: false,
        isOnboarding: updatedOnboarding,
      }));
    } catch (err) {
      console.error('Chat error:', err);
      set(s => ({ messages: s.messages.map(m => m.id === optimistic.id ? { ...m, _error: true } : m), isLoading: false }));
    }
  },

  addMessage: (msg) => set(s => ({ messages: [...s.messages, msg] })),
  setSession: (id) => set({ currentSessionId: id, messages: [] }),
  setLoading: (v) => set({ isLoading: v }),
  setRecording: (v) => set({ isRecording: v }),
  setOnboarding: (v) => set({ isOnboarding: v }),

  loadHistory: async () => {
    try {
      const res = await apiFetch('/chat/history');
      if (res.ok) {
        const data = await res.json();
        if (data.messages?.length) set({ messages: data.messages, currentSessionId: data.messages[0].sessionId });
      }
    } catch { /* silent */ }
  },
}));