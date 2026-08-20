'use client';

import { useApprovalStore, type Approval } from '@/stores/approvals.store';
import { AGENTS, getLayerConfig } from '@/config/agents';
import { CheckCircle, XCircle, Edit3, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from '../Toast';

export default function ApprovalQueue() {
  const approvals = useApprovalStore((s) => s.approvals);
  const approve = useApprovalStore((s) => s.approve);
  const reject = useApprovalStore((s) => s.reject);
  const edit = useApprovalStore((s) => s.edit);
  const unreadCount = useApprovalStore((s) => s.unreadCount);

  if (approvals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
          <ShieldCheck className="w-6 h-6 text-[var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">All clear</p>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-[220px]">
          When Helm&apos;s agents need your approval for high-risk actions (like spending money or sending public messages), they&apos;ll appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-2">
      <div className="px-2 py-1 flex items-center gap-1.5">
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </div>
      {approvals.map((approval) => (
        <ApprovalCard key={approval.id} approval={approval}
          onApprove={() => { approve(approval.id); toast('success', 'Approved'); }}
          onReject={() => { reject(approval.id); toast('info', 'Rejected'); }}
          onEdit={(text) => { edit(approval.id, text); toast('success', 'Approved with edits'); }}
        />
      ))}
    </div>
  );
}

function ApprovalCard({ approval, onApprove, onReject, onEdit }: {
  approval: Approval; onApprove: () => void; onReject: () => void; onEdit: (t: string) => void;
}) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(approval.action);
  const agent = AGENTS.find(a => a.id === approval.agentId);
  const layerCfg = getLayerConfig(approval.layer);

  return (
    <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: layerCfg.color + '20', color: layerCfg.color }}>
          {agent?.emoji || '🤖'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[var(--text-primary)] truncate">{agent?.name || approval.agentId}</p>
          <p className="text-[10px] text-[var(--text-muted)]">{layerCfg.name} layer</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
          <Clock className="w-3 h-3" />
          {new Date(approval.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      <div className="bg-[var(--bg-primary)] rounded-md p-2">
        {editMode ? (
          <textarea value={editText} onChange={e => setEditText(e.target.value)}
            className="w-full text-xs bg-transparent text-[var(--text-primary)] resize-none focus:outline-none" rows={2} />
        ) : (
          <p className="text-xs text-[var(--text-primary)]">{approval.action}</p>
        )}
      </div>

      {approval.reasoning && (
        <button onClick={() => setShowReasoning(!showReasoning)}
          className="text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          {showReasoning ? '▾ Hide' : '▸'} Reasoning
        </button>
      )}
      {showReasoning && approval.reasoning && (
        <p className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-primary)] rounded-md p-2">{approval.reasoning}</p>
      )}

      {approval.riskFactors?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {approval.riskFactors.map(f => (
            <span key={f} className="inline-flex items-center gap-0.5 text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
              <AlertTriangle className="w-2.5 h-2.5" /> {f}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        {editMode ? (
          <>
            <button onClick={() => { if(editText.trim()) onEdit(editText); setEditMode(false); }}
              className="flex-1 py-1.5 rounded-md bg-[var(--accent)] text-white text-[11px] font-medium hover:bg-[var(--accent-hover)] transition-colors">Save & Approve</button>
            <button onClick={() => setEditMode(false)}
              className="py-1.5 px-2 rounded-md border border-[var(--border)] text-[var(--text-secondary)] text-[11px] hover:bg-[var(--bg-tertiary)] transition-colors">Cancel</button>
          </>
        ) : (
          <>
            <button onClick={onApprove}
              className="flex-1 py-1.5 rounded-md bg-green-500/10 text-green-400 text-[11px] font-medium hover:bg-green-500/20 transition-colors flex items-center justify-center gap-1">
              <CheckCircle className="w-3 h-3" /> Approve
            </button>
            <button onClick={onReject}
              className="flex-1 py-1.5 rounded-md bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1">
              <XCircle className="w-3 h-3" /> Reject
            </button>
            <button onClick={() => setEditMode(true)}
              className="py-1.5 px-2 rounded-md border border-[var(--border)] text-[var(--text-secondary)] text-[11px] hover:bg-[var(--bg-tertiary)] transition-colors"><Edit3 className="w-3 h-3" /></button>
          </>
        )}
      </div>
    </div>
  );
}