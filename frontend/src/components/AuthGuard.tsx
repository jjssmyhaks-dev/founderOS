"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: Props) {
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if we have a token in localStorage
    const stored = localStorage.getItem('helm_token');
    if (!stored && !token) {
      router.replace('/login');
    } else if (stored && !token) {
      // Token exists but store not hydrated - verify it works
      fetch((process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/auth/me', {
        headers: { Authorization: `Bearer ${stored}` },
      })
        .then((r) => {
          if (r.ok) return r.json();
          throw new Error('invalid');
        })
        .then((user) => {
          useAuthStore.getState().setUser(user);
          useAuthStore.setState({ token: stored, isAuthenticated: true });
          setChecking(false);
        })
        .catch(() => {
          localStorage.removeItem('helm_token');
          router.replace('/login');
        });
    } else {
      setChecking(false);
    }
  }, [token, router]);

  if (checking) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}
