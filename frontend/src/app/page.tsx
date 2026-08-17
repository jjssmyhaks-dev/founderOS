"use client";

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import AuthGuard from '@/components/AuthGuard';
import Login from '@/components/Login';
import AppShell from '@/components/AppShell';

export default function Home() {
  const { isAuthenticated } = useAuthStore();

  return (
    <>
      {isAuthenticated ? (
        <AuthGuard>
          <AppShell />
        </AuthGuard>
      ) : (
        <Login />
      )}
    </>
  );
}
