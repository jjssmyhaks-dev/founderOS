"use client";

import { useState } from 'react';
import { useAuth } from '@/lib/hooks';
import Login from '@/components/Login';
import AppShell from '@/components/AppShell';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <AppShell />;
}
