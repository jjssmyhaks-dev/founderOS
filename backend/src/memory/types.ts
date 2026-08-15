export type MemoryType = 'founder_preference' | 'business_fact' | 'decision_log' | 'relationship_context' | 'strategic_goal' | 'constraint';
export type Confidence = 'founder_stated' | 'confirmed' | 'inferred';
export type MemoryStatus = 'active' | 'superseded' | 'archived';
export type MemoryLayer = 'research' | 'marketing' | 'operations' | 'finance' | 'global' | null;

export interface WriteMemoryInput {
  founderId: string;
  memoryType: MemoryType;
  content: string;
  layer?: MemoryLayer;
  confidence?: Confidence;
  sourceAgentId?: string;
  sourceTraceId?: string;
  sourceTaskId?: string;
}

export interface RetrieveMemoryInput {
  founderId: string;
  query: string;
  layer?: MemoryLayer;
  memoryTypes?: MemoryType[];
  maxResults?: number;
}

export interface MemoryNote {
  id: string;
  founderId: string;
  layer: string | null;
  category: string;
  memoryType: string;
  content: string;
  confidence: string;
  status: string;
  supersededBy: string | null;
  sourceAgentId: string | null;
  sourceTraceId: string | null;
  sourceTaskId: string | null;
  referenceCount: number;
  lastReferencedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
