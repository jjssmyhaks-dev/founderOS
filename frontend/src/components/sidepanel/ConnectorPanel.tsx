'use client';

import { useConnectorStore } from '@/stores/connectors.store';
import { CONNECTOR_DEFS } from '@/config/connectors';
import { LAYERS } from '@/config/agents';
import { Wifi, WifiOff, Loader2, Link2Off, Plug } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  CONNECTED: { dot: 'bg-green-400', label: 'Connected' },
  NEEDS_REAUTH: { dot: 'bg-yellow-400', label: 'Re-auth needed' },
  DISCONNECTED: { dot: 'bg-gray-500', label: 'Not connected' },
  ERROR: { dot: 'bg-red-400', label: 'Error' },
};

export default function ConnectorPanel() {
  const connectors = useConnectorStore(s => s.connectors);
  const connectingId = useConnectorStore(s => s.connectingId);
  const connect = useConnectorStore(s => s.connect);
  const disconnect = useConnectorStore(s => s.disconnect);

  if (connectors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
          <Plug className="w-6 h-6 text-[var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">No connectors yet</p>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-[220px]">
          Connect your tools as Helm suggests them during conversation — Slack, WhatsApp, Razorpay, Google Ads, and more. No need to set up everything upfront.
        </p>
      </div>
    );
  }

  const grouped: Record<string, typeof connectors> = {};
  for (const c of connectors) {
    const key = c.layer || 'CROSS_LAYER';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  }

  return (
    <div className="p-2 space-y-3">
      {Object.entries(grouped).map(([layer, items]) => (
        <div key={layer}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] px-2 mb-1">
            {LAYERS[layer as keyof typeof LAYERS]?.name || layer}
          </p>
          <div className="space-y-0.5">
            {items.map(c => {
              const status = STATUS_STYLES[c.status] || STATUS_STYLES.DISCONNECTED;
              const isConnecting = connectingId === c.connectorName;
              return (
                <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors">
                  <span className="text-sm">{c.displayName?.charAt(0) || c.connectorName.charAt(0)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-primary)] truncate">{c.displayName || c.connectorName}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">{status.label}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${status.dot}`} />
                  <button
                    onClick={async () => {
                      if (c.status === 'CONNECTED') {
                        await disconnect(c.connectorName);
                        toast.success('Disconnected');
                      } else {
                        await connect(c.connectorName);
                        toast.success('Connecting...');
                      }
                    }}
                    disabled={isConnecting}
                    className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
                  >
                    {isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : c.status === 'CONNECTED' ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}