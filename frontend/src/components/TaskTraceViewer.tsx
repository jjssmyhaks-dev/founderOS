import { useState } from 'react';

interface TaskStep {
  step: number;
  type: string;
  toolCall?: any;
  toolResult?: any;
  output?: any;
  error?: string;
  durationMs: number;
}

interface TaskTrace {
  task: {
    id: string;
    agentId: string;
    status: string;
    goal: string;
    traceId: string;
    startedAt: string;
    completedAt: string | null;
    currentStep: number;
    maxSteps: number;
    error: string | null;
    result: string | null;
  };
  steps: TaskStep[];
}

const statusColors: Record<string, string> = {
  RUNNING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  COMPLETED: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  FAILED: 'bg-red-500/20 text-red-400 border-red-500/30',
  AWAITING_APPROVAL: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const stepTypeIcons: Record<string, string> = {
  reasoning: '🧠',
  tool_call: '🔧',
  tool_result: '📋',
  final_answer: '✅',
  error: '❌',
  risk_gate_blocked: '🛑',
};

export default function TaskTraceViewer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const [trace, setTrace] = useState<TaskTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStep, setSelectedStep] = useState<TaskStep | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useState(() => {
    fetch(API_BASE + '/agent-runtime/tasks/' + taskId + '/trace')
      .then(r => r.json())
      .then(data => { setTrace(data); setLoading(false); })
      .catch(() => setLoading(false));
  });

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900/95 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading task trace...</div>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900/95 flex items-center justify-center">
        <div className="text-red-400">Failed to load trace for task {taskId}</div>
        <button onClick={onClose} className="ml-4 px-3 py-1 bg-gray-700 rounded text-sm">Close</button>
      </div>
    );
  }

  const task = trace.task;
  const totalDuration = trace.steps.reduce((sum, s) => sum + (s.durationMs || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 flex">
      {/* Sidebar - task overview */}
      <div className="w-80 border-r border-gray-800 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Task Trace</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">&times;</button>
        </div>

        <div className={"px-3 py-2 rounded-lg border text-sm font-medium mb-4 " + (statusColors[task.status] || 'bg-gray-700 text-gray-300')}>
          {task.status}
        </div>

        <div className="space-y-3 text-sm">
          <div><span className="text-gray-500">Agent:</span> <span className="text-gray-200 font-mono text-xs">{task.agentId}</span></div>
          <div><span className="text-gray-500">Goal:</span> <span className="text-gray-200">{task.goal}</span></div>
          <div><span className="text-gray-500">Trace:</span> <span className="text-gray-400 font-mono text-xs">{task.traceId}</span></div>
          <div><span className="text-gray-500">Steps:</span> <span className="text-gray-200">{task.currentStep} / {task.maxSteps}</span></div>
          <div><span className="text-gray-500">Duration:</span> <span className="text-gray-200">{(totalDuration / 1000).toFixed(1)}s</span></div>
          {task.startedAt && <div><span className="text-gray-500">Started:</span> <span className="text-gray-300">{new Date(task.startedAt).toLocaleString()}</span></div>}
          {task.completedAt && <div><span className="text-gray-500">Completed:</span> <span className="text-gray-300">{new Date(task.completedAt).toLocaleString()}</span></div>}
          {task.error && <div><span className="text-gray-500">Error:</span> <span className="text-red-400">{task.error}</span></div>}
          {task.result && <div><span className="text-gray-500">Result:</span> <span className="text-emerald-400">{task.result.substring(0, 200)}{task.result.length > 200 ? '...' : ''}</span></div>}
        </div>
      </div>

      {/* Main area - step timeline */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-sm font-medium text-gray-400">Execution Timeline ({trace.steps.length} steps)</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {trace.steps.map((s, i) => (
              <button
                key={i}
                onClick={() => setSelectedStep(selectedStep === s ? null : s)}
                className={"w-full text-left px-4 py-3 rounded-lg border transition-all " +
                  (selectedStep === s ? 'bg-gray-800 border-blue-500/50' : 'bg-gray-900 border-gray-800 hover:border-gray-700')}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{stepTypeIcons[s.type] || '?'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-500">#{s.step}</span>
                      <span className="text-sm font-medium text-gray-200 capitalize">{s.type.replace('_', ' ')}</span>
                      <span className="text-xs text-gray-600 ml-auto">{s.durationMs}ms</span>
                    </div>
                    {s.toolCall && (
                      <div className="text-xs text-blue-400 font-mono mt-1 truncate">
                        Tool: {s.toolCall.name}
                      </div>
                    )}
                    {s.error && (
                      <div className="text-xs text-red-400 mt-1 truncate">{s.error}</div>
                    )}
                    {s.output && s.type === 'final_answer' && (
                      <div className="text-xs text-emerald-400 mt-1 truncate">{String(s.output).substring(0, 100)}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail panel for selected step */}
        {selectedStep && (
          <div className="border-t border-gray-800 p-4 bg-gray-900/50 max-h-64 overflow-y-auto">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Step #{selectedStep.step} Detail</h4>
            <div className="space-y-2 text-xs font-mono">
              {selectedStep.toolCall && (
                <div>
                  <span className="text-gray-500">Tool Call:</span>
                  <pre className="mt-1 p-2 bg-gray-800 rounded text-blue-300 overflow-x-auto">{JSON.stringify(selectedStep.toolCall, null, 2)}</pre>
                </div>
              )}
              {selectedStep.toolResult && (
                <div>
                  <span className="text-gray-500">Tool Result:</span>
                  <pre className="mt-1 p-2 bg-gray-800 rounded text-emerald-300 overflow-x-auto">{JSON.stringify(selectedStep.toolResult, null, 2)}</pre>
                </div>
              )}
              {selectedStep.output && selectedStep.type !== 'final_answer' && (
                <div>
                  <span className="text-gray-500">Output:</span>
                  <pre className="mt-1 p-2 bg-gray-800 rounded text-gray-300 overflow-x-auto">{typeof selectedStep.output === 'string' ? selectedStep.output : JSON.stringify(selectedStep.output, null, 2)}</pre>
                </div>
              )}
              {selectedStep.error && (
                <div>
                  <span className="text-gray-500">Error:</span>
                  <pre className="mt-1 p-2 bg-red-900/30 rounded text-red-300">{selectedStep.error}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

