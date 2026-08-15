'use client';

import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';
import { Settings, ChevronRight, LogOut } from 'lucide-react';

interface Props { onToggleSide: () => void; sideOpen: boolean; }

export default function AppHeader({ onToggleSide, sideOpen }: Props) {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.refresh();
  };

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-xl">⭐</span>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Helm</h1>
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-[var(--text-muted)]">Online</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSide}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title={sideOpen ? 'Hide panel' : 'Show panel'}
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${sideOpen ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={() => router.push('/settings')}
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-[var(--border)] mx-1" />
        <span className="text-sm text-[var(--text-secondary)] hidden sm:block">
          {user?.name || user?.email}
        </span>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
          title="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
