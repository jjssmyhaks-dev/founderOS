import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ToolDefinition } from './types';
import { AGENT_REGISTRY } from '../agents/agents.service';

/**
 * Tool Registry — the central catalogue of every action an agent can take.
 *
 * Tools are split into two categories:
 *   1. Internal tools  (handler starts with "internal:")
 *      Executed entirely inside the NestJS process — no external HTTP calls.
 *   2. MCP tools       (handler starts with "mcp:")
 *      Routed through McpConnectorExecutor to external APIs.
 *
 * Each tool carries a riskTier that determines whether the runtime can
 * execute it autonomously, must notify the founder, or must wait for
 * explicit approval before proceeding.
 */
@Injectable()
export class ToolRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ToolRegistryService.name);
  private tools = new Map<string, ToolDefinition>();

  onModuleInit() {
    this.registerInternalTools();
    this.logger.log('Tool registry: ' + this.tools.size + ' tools loaded');
  }

  // ─── Internal tools ──────────────────────────────────────────────────

  private registerInternalTools() {
    const defs: Omit<ToolDefinition, 'allowedAgentIds'>[] = [
      // ── Knowledge & Memory ──────────────────────────────────────
      {
        name: 'query_context',
        description: 'Search the founder\'s context store for relevant notes, decisions, and business facts. Use this before answering questions about the business.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query describing what information you need' },
            category: { type: 'string', description: 'Optional category filter (e.g. "business", "decision", "constraint")' },
          },
          required: ['query'],
        },
        riskTier: 'AUTO_EXECUTE' as any,
        isReadOnly: true,
        timeoutMs: 8000,
        maxRetries: 2,
        handler: 'internal:context_query',
      },
      {
        name: 'write_memory',
        description: 'Write a new memory note to the founder\'s knowledge base. Use this to remember important facts, decisions, preferences, or constraints discovered during your work.',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The information to remember' },
            memoryType: {
              type: 'string',
              enum: ['founder_preference', 'business_fact', 'decision_log', 'relationship_context', 'strategic_goal', 'constraint'],
              description: 'Type of memory',
            },
            confidence: {
              type: 'string',
              enum: ['founder_stated', 'confirmed', 'inferred'],
              description: 'How confident you are in this information',
            },
            layer: { type: 'string', description: 'Which business layer this relates to (RESEARCH, MARKETING, OPERATIONS, FINANCE)' },
          },
          required: ['content', 'memoryType'],
        },
        riskTier: 'AUTO_EXECUTE' as any,
        isReadOnly: false,
        timeoutMs: 5000,
        maxRetries: 2,
        handler: 'internal:memory_write',
      },
      // ── Task Management ─────────────────────────────────────────
      {
        name: 'decompose_task',
        description: 'Break a complex goal into smaller subtasks. Use this when a request is too large or multifaceted to handle in a single execution pass.',
        parameters: {
          type: 'object',
          properties: {
            goal: { type: 'string', description: 'The high-level goal to decompose' },
            subtasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  agentId: { type: 'string', description: 'Which agent should handle this subtask' },
                  goal: { type: 'string', description: 'Specific subtask goal' },
                  priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
                },
              },
              description: 'List of subtasks to create',
            },
          },
          required: ['goal', 'subtasks'],
        },
        riskTier: 'NOTIFY_AND_ACT' as any,
        isReadOnly: false,
        timeoutMs: 10000,
        maxRetries: 1,
        handler: 'internal:task_decompose',
      },
      {
        name: 'schedule_action',
        description: 'Schedule a task to run at a future time or on a recurring basis. Use this for monitoring, reports, or follow-ups.',
        parameters: {
          type: 'object',
          properties: {
            goal: { type: 'string', description: 'What the scheduled task should do' },
            agentId: { type: 'string', description: 'Which agent should execute this' },
            layer: { type: 'string', description: 'Business layer (RESEARCH, MARKETING, OPERATIONS, FINANCE)' },
            runAt: { type: 'string', description: 'ISO timestamp for one-time execution, or cron expression for recurring (e.g. "0 9 * * 1-5" for weekdays at 9am)' },
            recurring: { type: 'boolean', description: 'Whether this should repeat on a schedule' },
          },
          required: ['goal', 'agentId', 'layer', 'runAt'],
        },
        riskTier: 'APPROVAL_REQUIRED' as any,
        isReadOnly: false,
        timeoutMs: 5000,
        maxRetries: 1,
        handler: 'internal:schedule',
      },
      {
        name: 'delegate_to_agent',
        description: 'Hand off a task to another agent. Use this when you need expertise from a different layer or specialist.',
        parameters: {
          type: 'object',
          properties: {
            targetAgentId: { type: 'string', description: 'ID of the agent to delegate to (e.g. "content-copywriter", "cashflow-forecasting")' },
            goal: { type: 'string', description: 'What you want the other agent to do' },
            context: { type: 'string', description: 'Additional context to pass along' },
          },
          required: ['targetAgentId', 'goal'],
        },
        riskTier: 'NOTIFY_AND_ACT' as any,
        isReadOnly: false,
        timeoutMs: 10000,
        maxRetries: 1,
        handler: 'internal:delegate',
      },
      // ── Communication ───────────────────────────────────────────
      {
        name: 'notify_founder',
        description: 'Send a notification to the founder. Use this for important updates, alerts, or when you need the founder\'s attention.',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'The notification message' },
            urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'How urgent this notification is' },
            actionUrl: { type: 'string', description: 'Optional URL to deep-link to relevant page' },
          },
          required: ['message'],
        },
        riskTier: 'AUTO_EXECUTE' as any,
        isReadOnly: false,
        timeoutMs: 3000,
        maxRetries: 2,
        handler: 'internal:notify',
      },
      {
        name: 'send_email',
        description: 'Send an email via a connected email service (Gmail, SendGrid, etc.). Requires the email connector to be configured.',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email address' },
            subject: { type: 'string', description: 'Email subject line' },
            body: { type: 'string', description: 'Email body (plain text or HTML)' },
            cc: { type: 'string', description: 'Optional CC addresses (comma-separated)' },
          },
          required: ['to', 'subject', 'body'],
        },
        riskTier: 'APPROVAL_REQUIRED' as any,
        isReadOnly: false,
        timeoutMs: 15000,
        maxRetries: 2,
        handler: 'internal:email',
      },
      {
        name: 'create_social_post',
        description: 'Create a draft social media post. Generates content but requires approval before publishing.',
        parameters: {
          type: 'object',
          properties: {
            platform: { type: 'string', enum: ['twitter', 'linkedin', 'instagram', 'facebook'], description: 'Target platform' },
            content: { type: 'string', description: 'Post content' },
            hashtags: { type: 'array', items: { type: 'string' }, description: 'Relevant hashtags' },
            mediaUrl: { type: 'string', description: 'Optional image/video URL' },
          },
          required: ['platform', 'content'],
        },
        riskTier: 'APPROVAL_REQUIRED' as any,
        isReadOnly: false,
        timeoutMs: 10000,
        maxRetries: 1,
        handler: 'internal:social_post',
      },
      // ── Data & Analysis ─────────────────────────────────────────
      {
        name: 'analyze_data',
        description: 'Perform calculations, comparisons, or analysis on structured data. Use this for financial analysis, performance metrics, or any quantitative work.',
        parameters: {
          type: 'object',
          properties: {
            data: { description: 'The data to analyze (object, array, or text with numbers)' },
            analysisType: { type: 'string', enum: ['calculate', 'compare', 'summarize', 'forecast', 'trend'], description: 'Type of analysis to perform' },
            question: { type: 'string', description: 'The specific question to answer from the data' },
          },
          required: ['data', 'analysisType', 'question'],
        },
        riskTier: 'AUTO_EXECUTE' as any,
        isReadOnly: true,
        timeoutMs: 15000,
        maxRetries: 1,
        handler: 'internal:analyze',
      },
      {
        name: 'web_search',
        description: 'Search the web for current information. Use this to find up-to-date data, competitor info, market trends, or any real-world information.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            numResults: { type: 'number', description: 'Number of results to return (1-10, default 5)' },
          },
          required: ['query'],
        },
        riskTier: 'AUTO_EXECUTE' as any,
        isReadOnly: true,
        timeoutMs: 15000,
        maxRetries: 2,
        handler: 'internal:web_search',
      },
      {
        name: 'read_documents',
        description: 'Read and search through the founder\'s documents, notes, and files stored in the knowledge base.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'What to search for in documents' },
            source: { type: 'string', description: 'Optional specific document source or type to search' },
          },
          required: ['query'],
        },
        riskTier: 'AUTO_EXECUTE' as any,
        isReadOnly: true,
        timeoutMs: 8000,
        maxRetries: 2,
        handler: 'internal:documents',
      },
      // ── Activity & Status ───────────────────────────────────────
      {
        name: 'read_activity_log',
        description: 'Read the activity log to see what has happened recently across agents, tasks, and events.',
        parameters: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Number of entries to return (default 10)' },
            agentId: { type: 'string', description: 'Filter by specific agent' },
            type: { type: 'string', description: 'Filter by activity type (e.g. "TASK_COMPLETED", "TASK_FAILED")' },
          },
          required: [],
        },
        riskTier: 'AUTO_EXECUTE' as any,
        isReadOnly: true,
        timeoutMs: 5000,
        maxRetries: 2,
        handler: 'internal:activity_read',
      },
      {
        name: 'get_task_status',
        description: 'Check the status and results of a specific task or all active tasks.',
        parameters: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Specific task ID to check (omit for all active tasks)' },
            status: { type: 'string', description: 'Filter by status (RUNNING, COMPLETED, FAILED, AWAITING_APPROVAL)' },
          },
          required: [],
        },
        riskTier: 'AUTO_EXECUTE' as any,
        isReadOnly: true,
        timeoutMs: 5000,
        maxRetries: 2,
        handler: 'internal:task_status',
      },
      // ── Events & Communication ──────────────────────────────────
      {
        name: 'publish_event',
        description: 'Publish an event that other agents can react to. Use this to signal cross-layer coordination.',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Event type (e.g. "competitor.detected", "campaign.budget_exhausted")' },
            payload: { type: 'object', description: 'Event data payload' },
          },
          required: ['type', 'payload'],
        },
        riskTier: 'AUTO_EXECUTE' as any,
        isReadOnly: false,
        timeoutMs: 3000,
        maxRetries: 3,
        handler: 'internal:events',
      },
      {
        name: 'request_approval',
        description: 'Request explicit founder approval before taking a high-risk action. Always explain WHY approval is needed.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', description: 'Description of the action you want to take' },
            reasoning: { type: 'string', description: 'Why this action needs approval and what happens if approved/rejected' },
            riskFactors: { type: 'array', items: { type: 'string' }, description: 'Specific risk factors to highlight' },
          },
          required: ['action', 'reasoning'],
        },
        riskTier: 'APPROVAL_REQUIRED' as any,
        isReadOnly: false,
        timeoutMs: 3000,
        maxRetries: 1,
        handler: 'internal:approvals',
      },
    ];

    for (const t of defs) {
      this.tools.set(t.name, { ...t, allowedAgentIds: [] });
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────

  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getToolsForAgent(agentId: string): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(
      (t) => t.allowedAgentIds.length === 0 || t.allowedAgentIds.includes(agentId),
    );
  }

  getToolSchemasForAgent(agentId: string): any[] {
    return this.getToolsForAgent(agentId).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  registerMcpTool(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  removeMcpTool(name: string) {
    this.tools.delete(name);
  }

  listAllTools(): Array<{ name: string; description: string; riskTier: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      riskTier: t.riskTier,
    }));
  }
}
