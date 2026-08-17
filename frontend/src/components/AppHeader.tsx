"use client";

import { useAuthStore } from '@/stores/auth.store';
import { useApprovalStore } from '@/stores/approvals.store';
import { useRouter } from 'next/navigation';
import { Zap, PanelRightOpen, PanelRightClose, BarChart3, Eye, Settings, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from './Toast';
import Link from 'next/link';

interface Props { onToggleSide: () => void; sideOpen: boolean; }

export default function AppHeader({ onToggleSide, sideOpen }: Props) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const unreadCount = useApprovalStore((s) => s.unreadCount);
  const [mobileMenu, setMobileMenu] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
    toast('info', 'Logged out');
  };

  return (
    <>
      <header className="h-14 border-b border-[var(--border)] bg-[var(--bg-secondary)]/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white hidden sm:inline">Helm</span>
          </div>
          <button onClick={onToggleSide} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-tertiary)] transition-colors">
            {sideOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Link href="/observability" className="hidden sm:flex p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-tertiary)] transition-colors" title="Traces">
            <Eye className="w-4 h-4" />
          </Link>
          <Link href="/admin" className="hidden sm:flex p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-tertiary)] transition-colors" title="Admin Dashboard">
            <BarChart3 className="w-4 h-4" />
          </Link>
          <Link href="/settings" className="hidden sm:flex p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-tertiary)] transition-colors" title="Settings">
            <Settings className="w-4 h-4" />
          </Link>

          <div className="w-px h-6 bg-[var(--border)] mx-1 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-300">
              {user?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-tertiary)] transition-colors" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMobileMenu(!mobileMenu)} className="sm:hidden p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white">
            {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile dropdown menu */}
      {mobileMenu && (
        <div className="sm:hidden absolute top-14 left-0 right-0 bg-[var(--bg-secondary)] border-b border-[var(--border)] z-40 p-2 space-y-1">
          <Link href="/observability" onClick={() => setMobileMenu(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-tertiary)]">
            <Eye className="w-4 h-4" /> <span className="text-sm">Traces</span>
          </Link>
          <Link href="/admin" onClick={() => setMobileMenu(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-tertiary)]">
            <BarChart3 className="w-4 h-4" /> <span className="text-sm">Admin</span>
          </Link>
          <Link href="/settings" onClick={() => setMobileMenu(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-tertiary)]">
            <Settings className="w-4 h-4" /> <span className="text-sm">Settings</span>
          </Link>
        </div>
      )}
    </>
  );
}
