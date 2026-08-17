const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function apiHeaders(token?: string | null): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('helm_token') : null;
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...apiHeaders(token), ...options.headers },
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('helm_token');
      window.location.reload();
    }
    throw new Error('Session expired');
  }
  return res;
}

export const WS_URL = API_BASE.replace(/^http/, 'ws');
