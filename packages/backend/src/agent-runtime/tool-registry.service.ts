import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ToolDefinition } from './types';
import { AGENT_REGISTRY } from '../agents/agents.service';

@Injectable()
export class ToolRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ToolRegistryService.name);
  private tools = new Map<string, ToolDefinition>();

  onModuleInit() { this.registerInternalTools(); this.logger.log('Tool registry: ' + this.tools.size + ' tools'); }

  private registerInternalTools() {
    const defs: Omit<ToolDefinition, 'allowedAgentIds'>[] = [
      { name: 'query_context', description: 'Search context notes', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, riskTier: 'AUTO_EXECUTE' as any, isReadOnly: true, timeoutMs: 5000, maxRetries: 2, handler: 'internal:context' },
      { name: 'publish_event', description: 'Publish event', parameters: { type: 'object', properties: { type: { type: 'string' }, payload: { type: 'object' } }, required: ['type', 'payload'] }, riskTier: 'AUTO_EXECUTE' as any, isReadOnly: false, timeoutMs: 3000, maxRetries: 3, handler: 'internal:events' },
      { name: 'request_approval', description: 'Request founder approval', parameters: { type: 'object', properties: { action: { type: 'string' }, reasoning: { type: 'string' } }, required: ['action', 'reasoning'] }, riskTier: 'APPROVAL_REQUIRED' as any, isReadOnly: false, timeoutMs: 3000, maxRetries: 1, handler: 'internal:approvals' },
      { name: 'escalate_to_founder', description: 'Escalate to founder', parameters: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] }, riskTier: 'AUTO_EXECUTE' as any, isReadOnly: false, timeoutMs: 3000, maxRetries: 1, handler: 'internal:activity' },
      { name: 'read_activity_log', description: 'Read activity log', parameters: { type: 'object', properties: { limit: { type: 'number' } }, required: [] }, riskTier: 'AUTO_EXECUTE' as any, isReadOnly: true, timeoutMs: 5000, maxRetries: 2, handler: 'internal:activity' },
    ];
    for (const t of defs) this.tools.set(t.name, { ...t, allowedAgentIds: [] });
  }

  getTool(name: string): ToolDefinition | undefined { return this.tools.get(name); }
  getToolsForAgent(agentId: string): ToolDefinition[] { return Array.from(this.tools.values()).filter(t => t.allowedAgentIds.length === 0 || t.allowedAgentIds.includes(agentId)); }
  getToolSchemasForAgent(agentId: string): any[] { return this.getToolsForAgent(agentId).map(t => ({ name: t.name, description: t.description, input_schema: t.parameters })); }
  registerMcpTool(tool: ToolDefinition) { this.tools.set(tool.name, tool); }
  removeMcpTool(name: string) { this.tools.delete(name); }
}
