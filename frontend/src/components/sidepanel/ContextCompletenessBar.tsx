interface LayerScore {
  layer: string;
  totalNotes: number;
  businessFacts: number;
  strategicGoals: number;
  constraints: number;
  otherNotes: number;
  score: number;
}

interface CompletenessData {
  overall: number;
  layers: LayerScore[];
}

const LAYER_COLORS: Record<string, string> = {
  Global: 'var(--accent)',
  Research: '#818cf8',
  Marketing: '#f472b6',
  Operations: '#fb923c',
  Finance: '#34d399',
};

export default function ContextCompletenessBar({ data }: { data: CompletenessData | null }) {
  if (!data || !data.layers.length) {
    return (
      <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Context completeness</p>
          <span className="text-[10px] text-[var(--text-muted)]">Collecting...</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)]">
          <div className="h-full rounded-full bg-[var(--text-muted)]/20 w-0" />
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mt-1.5">Start chatting and Helm will learn about your business.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-[var(--text-secondary)]">Context completeness</p>
        <span className="text-xs font-bold" style={{ color: data.overall >= 70 ? '#34d399' : data.overall >= 40 ? '#fbbf24' : 'var(--text-muted)' }}>
          {data.overall}%
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--bg-tertiary)] overflow-hidden flex gap-0.5">
        {data.layers.map((l) => (
          <div
            key={l.layer}
            className="h-full rounded-full transition-all duration-500"
            style={{
              flex: l.score || 0.5,
              backgroundColor: LAYER_COLORS[l.layer] || 'var(--text-muted)',
              opacity: l.score > 0 ? 1 : 0.2,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
        {data.layers.map((l) => (
          <div key={l.layer} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: LAYER_COLORS[l.layer] || 'var(--text-muted)' }} />
            <span className="text-[10px] text-[var(--text-muted)]">{l.layer}</span>
            <span className="text-[10px] text-[var(--text-secondary)]">{l.score}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}