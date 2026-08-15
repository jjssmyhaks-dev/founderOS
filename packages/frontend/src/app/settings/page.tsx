'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const TIERS = [
  { value: 'AUTO_EXECUTE', label: 'Auto-Execute', desc: 'Reversible, no cost. Executes immediately.' },
  { value: 'NOTIFY_AND_ACT', label: 'Notify & Act', desc: 'Proceeds but flags for visibility.' },
  { value: 'APPROVAL_REQUIRED', label: 'Approval Required', desc: 'Waits for your explicit approval.' },
];

const LAYER_TIERS = [
  { key: 'research', name: 'Research', color: '#3b82f6', defaultTier: 'NOTIFY_AND_ACT' },
  { key: 'marketing', name: 'Marketing', color: '#a855f7', defaultTier: 'NOTIFY_AND_ACT' },
  { key: 'operations', name: 'Operations', color: '#f59e0b', defaultTier: 'NOTIFY_AND_ACT' },
  { key: 'finance', name: 'Finance', color: '#22c55e', defaultTier: 'APPROVAL_REQUIRED' },
];

export default function SettingsPage() {
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [tiers, setTiers] = useState<Record<string, string>>(
    Object.fromEntries(LAYER_TIERS.map(l => [l.key, l.defaultTier]))
  );

  const handleSaveAutonomy = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('helm_token');
      const res = await fetch('http://localhost:4000/api/auth/autonomy-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(Object.fromEntries(Object.entries(tiers).map(([k, v]) => [k, { defaultTier: v }]))),
      });
      if (res.ok) toast.success('Autonomy settings saved');
      else toast.error('Failed to save');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-8">Settings</h1>

        {/* Profile */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Profile</h2>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Name</label>
                <div className="text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] rounded-lg px-3 py-2 border border-[var(--border)]">{user?.name || '—'}</div>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Email</label>
                <div className="text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] rounded-lg px-3 py-2 border border-[var(--border)]">{user?.email || '—'}</div>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Business</label>
                <div className="text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] rounded-lg px-3 py-2 border border-[var(--border)]">{user?.businessName || '—'}</div>
              </div>
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">Timezone</label>
                <div className="text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] rounded-lg px-3 py-2 border border-[var(--border)]">Asia/Calcutta</div>
              </div>
            </div>
          </div>
        </section>

        {/* Autonomy Controls */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Autonomy Controls</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">Control how much each layer can do without asking. Finance defaults to requiring approval.</p>
          <div className="space-y-3">
            {LAYER_TIERS.map(layer => (
              <div key={layer.key} className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: layer.color }} />
                  <h3 className="text-sm font-medium text-[var(--text-primary)]">{layer.name} Layer</h3>
                </div>
                <div className="flex gap-2">
                  {TIERS.map(tier => (
                    <button
                      key={tier.value}
                      onClick={() => setTiers(prev => ({ ...prev, [layer.key]: tier.value }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        tiers[layer.key] === tier.value
                          ? 'bg-[var(--accent)] text-white ring-2 ring-[var(--accent)]/30'
                          : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-2">
                  {TIERS.find(t => t.value === tiers[layer.key])?.desc}
                </p>
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveAutonomy}
            disabled={saving}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </section>
      </div>
    </div>
  );
}