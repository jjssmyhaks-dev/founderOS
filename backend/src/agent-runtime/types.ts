export enum RiskTier {
  AUTO_EXECUTE = 'AUTO_EXECUTE',
  NOTIFY_AND_ACT = 'NOTIFY_AND_ACT',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
}

export interface AgentTask {
  taskId: string;
  agentId: string;
  triggerType: 'orchestrator_assigned' | 'scheduled' | 'event_triggered';
  goal: string;
  contextRefs: string[];
  riskTierHint: RiskTier | null;
  deadline: Date | null;
  parentTaskId: string | null;
  founderId: string;
  layer: string;
  traceId?: string;
}

export interface AgentConfig {
  agentId: string;
  name: string;
  layer: string;
  systemPrompt: string;
  model: string;
  maxSteps: number;
  contextTokenBudget: number;
  toolIds: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  riskTier: RiskTier;
  isReadOnly: boolean;
  timeoutMs: number;
  maxRetries: number;
  allowedAgentIds: string[];
  handler: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface ToolResult {
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
  idempotencyKey?: string;
}

export type StepType = 'reasoning' | 'tool_call' | 'tool_result' | 'final_answer' | 'error' | 'risk_gate_blocked';

export interface StepRecord {
  stepNumber: number;
  type: StepType;
  input?: unknown;
  output?: unknown;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  error?: string;
  durationMs: number;
}

export interface ExecutionResult {
  taskId: string;
  status: 'completed' | 'failed' | 'awaiting_approval' | 'deadline_exceeded';
  result?: string;
  error?: string;
  totalSteps: number;
  totalDurationMs: number;
}

export const MODEL_TIERS: Record<string, string> = {
  ORCHESTRATOR: 'claude-2.1',
  RESEARCH_DEEP: 'claude-2.1',
  FINANCE: 'claude-2.1',
  MARKETING: 'claude-instant-v1',
  OPERATIONS: 'claude-instant-v1',
  DEFAULT: 'claude-2.1',
};
