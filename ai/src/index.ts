// ===== Agent Types =====

export enum AgentStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  WAITING_APPROVAL = 'WAITING_APPROVAL',
  ERROR = 'ERROR',
  DISABLED = 'DISABLED',
}

export enum AgentRole {
  GLOBAL_ORCHESTRATOR = 'GLOBAL_ORCHESTRATOR',
  LAYER_ORCHESTRATOR = 'LAYER_ORCHESTRATOR',
  SUB_AGENT = 'SUB_AGENT',
}

export enum LayerType {
  RESEARCH = 'RESEARCH',
  MARKETING = 'MARKETING',
  OPERATIONS = 'OPERATIONS',
  FINANCE = 'FINANCE',
}

export interface SubAgentDefinition {
  id: string;
  name: string;
  layer: LayerType;
  role: AgentRole.SUB_AGENT;
  responsibility: string;
  emits: string[];
  listensFor: string[];
}

export interface AgentState {
  agentId: string;
  status: AgentStatus;
  currentTaskId?: string;
  lastActivity: Date;
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    avgResponseMs: number;
  };
}

export interface TaskDecomposition {
  parentTaskId: string;
  subTasks: TaskBrief[];
}

export interface TaskBrief {
  agentId: string;
  title: string;
  priority: TaskPriority;
}

// ===== Task Types =====

export enum TaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  BLOCKED = 'BLOCKED',
  CANCELLED = 'CANCELLED',
}

export enum RiskTier {
  AUTO_EXECUTE = 'AUTO_EXECUTE',
  NOTIFY_AND_ACT = 'NOTIFY_AND_ACT',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface Task {
  id: string;
  founderId: string;
  layer: LayerType;
  agentId?: string;
  title: string;
  description: string;
  status: TaskStatus;
  riskTier: RiskTier;
  priority: TaskPriority;
  parentTaskId?: string;
  metadata?: Record<string, any>;
  result?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TaskCreateDto {
  title: string;
  description: string;
  layer?: LayerType;
  riskTier?: RiskTier;
  priority?: TaskPriority;
  parentTaskId?: string;
  metadata?: Record<string, any>;
}

export interface TaskUpdateDto {
  status?: TaskStatus;
  riskTier?: RiskTier;
  priority?: TaskPriority;
  result?: string;
  error?: string;
}

// ===== Event Types =====

export enum EventType {
  // Research
  COMPETITOR_DETECTED = 'competitor.detected',
  MARKET_TREND_SHIFT = 'market.trend_shift',
  PRICING_BENCHMARK_CHANGED = 'pricing.benchmark_changed',
  RESEARCH_REQUESTED = 'research.requested',
  // Marketing
  LEAD_SOURCE_UNDERPERFORMING = 'lead_source.underperforming',
  CAMPAIGN_BUDGET_EXHAUSTED = 'campaign.budget_exhausted',
  AUDIENCE_SEGMENT_SHIFT = 'audience.segment_shift',
  // Operations
  FEATURE_SHIPPED = 'operations.feature_shipped',
  DELIVERY_DELAYED = 'delivery.delayed',
  CAPACITY_CONSTRAINED = 'capacity.constrained',
  QUALITY_ISSUE_DETECTED = 'quality.issue_detected',
  DEMAND_SPIKE_INCOMING = 'marketing.demand_spike_incoming',
  // Finance
  BUDGET_CONSTRAINT = 'finance.budget_constraint',
  BUDGET_CUT = 'finance.budget_cut',
  CASHFLOW_RISK = 'cashflow.risk',
  EXPENSE_SPIKE = 'expense.spike',
  REVENUE_MILESTONE_HIT = 'revenue.milestone_hit',
  // Approval
  APPROVAL_REQUESTED = 'approval.requested',
  APPROVAL_RESOLVED = 'approval.resolved',
  // Agent lifecycle
  AGENT_STATUS_CHANGED = 'agent.status_changed',
  TASK_CREATED = 'task.created',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  // Connector
  CONNECTOR_STATUS_CHANGED = 'connector.status_changed',
}

export interface Event {
  id: string;
  type: EventType;
  publisher: string;
  payload: Record<string, any>;
  timestamp: Date;
  correlationId?: string;
}

export interface EventSubscription {
  id: string;
  subscriberAgentId: string;
  eventTypes: string[];
  createdAt: Date;
}

// ===== Approval Types =====

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EDITED = 'EDITED',
  EXPIRED = 'EXPIRED',
}

export interface Approval {
  id: string;
  taskId: string;
  agentId: string;
  layer: LayerType;
  action: string;
  reasoning: string;
  riskTier: RiskTier;
  riskFactors: string[];
  status: ApprovalStatus;
  resolution?: string;
  editedAction?: string;
  founderId: string;
  expiresAt: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface ApprovalResponseDto {
  status: ApprovalStatus.APPROVED | ApprovalStatus.REJECTED | ApprovalStatus.EDITED;
  resolution?: string;
  editedAction?: string;
}

// ===== Connector Types =====

export enum ConnectorAuthType {
  OAUTH = 'OAUTH',
  API_KEY = 'API_KEY',
  WEBHOOK = 'WEBHOOK',
}

export enum ConnectorStatus {
  CONNECTED = 'CONNECTED',
  NEEDS_REAUTH = 'NEEDS_REAUTH',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

export interface ConnectorDefinition {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  authType: ConnectorAuthType;
  layer: LayerType | 'CROSS_LAYER';
  scopes: string[];
  tools: string[];
}

export interface ConnectorInstance {
  id: string;
  founderId: string;
  connectorName: string;
  status: ConnectorStatus;
  lastHealthCheck?: Date;
  lastSuccessfulCall?: Date;
  authMetadata?: Record<string, any>;
  createdAt: Date;
}

export interface ConnectorManifest {
  name: string;
  version: string;
  authType: ConnectorAuthType;
  tools: { name: string; description: string; parameters: Record<string, any> }[];
  layers: (LayerType | 'CROSS_LAYER')[];
}

// ===== Chat Types =====

export enum ChatMessageRole {
  FOUNDER = 'FOUNDER',
  AGENT = 'AGENT',
  SYSTEM = 'SYSTEM',
}

export interface ChatMessage {
  id: string;
  founderId: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  agentId?: string;
  layer?: LayerType;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface ChatSession {
  id: string;
  founderId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VoiceInput {
  audioData: Uint8Array;
  format: string;
  language?: string;
}

// ===== Founder Types =====

export interface Founder {
  id: string;
  email: string;
  name: string;
  businessName?: string;
  businessDescription?: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LayerAutonomyConfig {
  defaultTier: RiskTier;
  overrides?: Record<string, RiskTier>;
}

export interface AutonomySettings {
  research: LayerAutonomyConfig;
  marketing: LayerAutonomyConfig;
  operations: LayerAutonomyConfig;
  finance: LayerAutonomyConfig;
}

export interface FounderProfileDto {
  name?: string;
  businessName?: string;
  businessDescription?: string;
  timezone?: string;
}

// ===== Context Types =====

export enum ContextCategory {
  BUSINESS_GOAL = 'BUSINESS_GOAL',
  DECISION = 'DECISION',
  MARKET_INSIGHT = 'MARKET_INSIGHT',
  CUSTOMER_INSIGHT = 'CUSTOMER_INSIGHT',
  OPERATIONAL_NOTE = 'OPERATIONAL_NOTE',
  FINANCIAL_NOTE = 'FINANCIAL_NOTE',
}

export interface ContextNote {
  id: string;
  founderId: string;
  category: ContextCategory;
  content: string;
  embeddingId?: string;
  sourceAgentId?: string;
  sourceTaskId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Activity Types =====

export enum ActivityType {
  TASK_STARTED = 'TASK_STARTED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_FAILED = 'TASK_FAILED',
  APPROVAL_REQUESTED = 'APPROVAL_REQUESTED',
  APPROVAL_RESOLVED = 'APPROVAL_RESOLVED',
  CONNECTOR_USED = 'CONNECTOR_USED',
  EVENT_PUBLISHED = 'EVENT_PUBLISHED',
  EVENT_RECEIVED = 'EVENT_RECEIVED',
  AGENT_STATUS_CHANGE = 'AGENT_STATUS_CHANGE',
  AUTONOMY_OVERRIDDEN = 'AUTONOMY_OVERRIDDEN',
}

export interface ActivityLog {
  id: string;
  founderId: string;
  agentId?: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// ===== Orchestration Types =====

export interface OrchestratorState {
  currentGoals: string[];
  activeLayers: LayerType[];
  pendingDecisions: string[];
  systemHealth: {
    agentsOnline: number;
    agentsTotal: number;
    connectorsHealthy: number;
    connectorsTotal: number;
  };
}

export interface RoutingDecision {
  inputMessage: string;
  selectedLayer: LayerType;
  selectedAgent?: string;
  reasoning: string;
  confidence: number;
  delegatedSubTasks?: TaskBrief[];
}
