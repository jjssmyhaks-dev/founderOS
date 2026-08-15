import { create } from 'zustand';

interface AuthState {
  user: { id: string; email: string; name: string; businessName?: string } | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: any) => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('helm_token') : null;
  return {
    user: null, token, isAuthenticated: !!token, isLoading: false,
    login: async (email, password) => {
      set({ isLoading: true });
      try {
        const res = await fetch('http://localhost:4000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Login failed'); }
        const data = await res.json();
        localStorage.setItem('helm_token', data.access_token);
        set({ user: data.founder, token: data.access_token, isAuthenticated: true, isLoading: false });
      } catch (e: any) { set({ isLoading: false }); throw e; }
    },
    signup: async (name, email, password) => {
      set({ isLoading: true });
      try {
        const res = await fetch('http://localhost:4000/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
        if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Signup failed'); }
        const data = await res.json();
        localStorage.setItem('helm_token', data.access_token);
        set({ user: data.founder, token: data.access_token, isAuthenticated: true, isLoading: false });
      } catch (e: any) { set({ isLoading: false }); throw e; }
    },
    logout: () => { localStorage.removeItem('helm_token'); set({ user: null, token: null, isAuthenticated: false }); },
    setUser: (user) => set({ user }),
  };
});
