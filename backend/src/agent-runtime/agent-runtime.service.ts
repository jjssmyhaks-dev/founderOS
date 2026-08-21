import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { EventService } from '../events/events.service';
import { ActivityService } from '../activity/activity.service';
import { ToolRegistryService } from './tool-registry.service';
import { ContextAssemblerService } from './context-assembler.service';
import { RiskGateService } from './risk-gate.service';
import { McpConnectorExecutor } from './mcp-connector-executor.service';
import { MemoryService } from '../memory/memory.service';
import { ContextService } from '../context/context.service';
import { SpanEmitterService } from '../observability/span-emitter.service';
import { getConnectorConfig } from '../connectors/connector-config';
import { AgentTask, AgentConfig, ExecutionResult, StepType, ToolCall, ToolResult, MODEL_TIERS } from './types';
import { v4 } from 'uuid';

@Injectable()
export class AgentRuntimeService {
  private readonly logger = new Logger(AgentRuntimeService.name);
  private readonly idempotencyCache = new Map<string, ToolResult>();

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
    private events: EventService,
    private activity: ActivityService,
    private toolRegistry: ToolRegistryService,
    private contextAssembler: ContextAssemblerService,
    private riskGate: RiskGateService,
    private mcpExecutor: McpConnectorExecutor,
    private memory: MemoryService,
    private context: ContextService,
    private spanEmitter: SpanEmitterService,
    private config: ConfigService,
  ) {}

  // ─── Main execution loop ──────────────────────────────────────────────

  async executeTask(task: AgentTask, config: AgentConfig): Promise<ExecutionResult> {
    const startTime = Date.now();
    const traceId = task.traceId || uuidv4();
    this.logger.log('Starting task ' + task.taskId + ' for agent ' + task.agentId + ' trace=' + traceId);

    // Ensure the parent trace exists before emitting spans
    try {
      await this.prisma.trace.upsert({
        where: { id: traceId },
        create: { id: traceId, originType: 'event_triggered', originRef: task.taskId, founderId: task.founderId, status: 'in_progress' },
        update: {},
      });
    } catch (e) {
      this.logger.warn('Failed to upsert trace ' + traceId + ': ' + String(e));
    }

    await this.spanEmitter.emit({ traceId, agentId: task.agentId, taskId: task.taskId, spanType: 'task', status: 'in_progress', inputSummary: task.goal.substring(0, 200) });

    try {
      await this.prisma.task.update({
        where: { id: task.taskId },
        data: {
          status: 'RUNNING', startedAt: new Date(), goal: task.goal,
          triggerType: task.triggerType, contextRefs: task.contextRefs,
          riskTierHint: task.riskTierHint || null, deadline: task.deadline || null,
          parentTaskId: task.parentTaskId || null, traceId,
          maxSteps: config.maxSteps, modelOverride: config.model,
        },
      });

      const systemContext = await this.contextAssembler.assemble({ ...task, traceId }, config);
      const loopHistory: Array<{ role: string; content: string }> = [
        { role: 'user', content: task.goal },
      ];
      let consecutiveToolFailures = 0;

      for (let step = 0; step < config.maxSteps; step++) {
        if (task.deadline && new Date() > task.deadline) {
          await this.recordStep(task.taskId, step, 'error', null, null, null, null, 'Deadline exceeded', 0);
          await this.failTask(task.taskId, 'deadline_exceeded', 'Task deadline passed');
          await this.notifyFounder(task.founderId, 'Task deadline exceeded: ' + task.goal.substring(0, 100), task.taskId);
          return { taskId: task.taskId, status: 'deadline_exceeded', error: 'Deadline exceeded', totalSteps: step, totalDurationMs: Date.now() - startTime };
        }

        const stepStart = Date.now();
        let response: string;
        try {
          response = await this.llm.complete({
            prompt: this.buildPrompt(loopHistory),
            system: systemContext,
            model: config.model || MODEL_TIERS.DEFAULT,
            maxTokens: 2048,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await this.recordStep(task.taskId, step, 'error', null, null, null, null, 'LLM failed: ' + errMsg, Date.now() - stepStart);
          loopHistory.push({ role: 'assistant', content: 'Error: ' + errMsg });
          continue;
        }

        const stepSpanId = await this.spanEmitter.emit({ traceId, agentId: task.agentId, taskId: task.taskId, spanType: 'reasoning_step', status: 'success', inputSummary: 'LLM reasoning step ' + step, outputSummary: response.substring(0, 200) });
        const toolCall = this.parseToolCall(response);

        if (!toolCall) {
          await this.recordStep(task.taskId, step, 'final_answer', response, null, null, null, undefined, Date.now() - stepStart);
          await this.spanEmitter.emit({ traceId, agentId: task.agentId, taskId: task.taskId, spanType: 'reasoning_step', status: 'success', outputSummary: response.substring(0, 200), parentSpanId: stepSpanId });
          await this.completeTask(task.taskId, response);
          await this.activity.logActivity({ founderId: task.founderId, type: 'TASK_COMPLETED', description: 'Agent completed: ' + task.goal.substring(0, 100) });
          await this.events.publish({
            type: 'task.completed', publisher: task.agentId,
            payload: { taskId: task.taskId, result: response } as any,
            correlationId: traceId, founderId: task.founderId,
          });
          await this.spanEmitter.emit({ traceId, agentId: task.agentId, taskId: task.taskId, spanType: 'task', status: 'success', outputSummary: 'Task completed' });
          // Auto-learn: write a memory about what was accomplished
          await this.autoLearn(task, response).catch(() => {});
          return { taskId: task.taskId, status: 'completed', result: response, totalSteps: step + 1, totalDurationMs: Date.now() - startTime };
        }

        const tool = this.toolRegistry.getTool(toolCall.name);
        if (!tool) {
          loopHistory.push({ role: 'assistant', content: response });
          loopHistory.push({ role: 'user', content: 'Error: Unknown tool ' + toolCall.name + '. Available: ' + this.toolRegistry.getToolsForAgent(task.agentId).map((t: any) => t.name).join(', ') });
          await this.recordStep(task.taskId, step, 'tool_call', response, null, toolCall, null, 'Unknown tool', Date.now() - stepStart);
          continue;
        }

        toolCall.idempotencyKey = task.taskId + ':' + step + ':' + toolCall.name;
        const cached = this.idempotencyCache.get(toolCall.idempotencyKey);
        if (cached) {
          this.logger.warn('Idempotency cache hit: ' + toolCall.idempotencyKey);
          await this.recordStep(task.taskId, step, 'tool_result', null, cached.output, toolCall, cached, undefined, 0);
          loopHistory.push({ role: 'assistant', content: response });
          await this.spanEmitter.complete(stepSpanId, 'Tool ' + toolCall.name + ' completed');
          loopHistory.push({ role: 'user', content: 'Tool ' + toolCall.name + ': ' + JSON.stringify(cached.output) + ' (cached result)' });
          continue;
        }

        await this.spanEmitter.emit({ traceId, agentId: task.agentId, taskId: task.taskId, spanType: 'tool_call', status: 'pending', inputSummary: 'Tool: ' + toolCall.name, parentSpanId: stepSpanId });
        const gate = await this.riskGate.check(tool, toolCall, task.taskId, task.agentId, task.founderId, task.layer);
        await this.recordStep(task.taskId, step, 'tool_call', response, null, toolCall, null, undefined, Date.now() - stepStart);

        if (!gate.allowed) {
          await this.prisma.task.update({ where: { id: task.taskId }, data: { status: 'AWAITING_APPROVAL' } });
          await this.activity.logActivity({ founderId: task.founderId, type: 'TASK_SUSPENDED', description: 'Task awaiting approval: ' + (gate.reason || '') });
          return { taskId: task.taskId, status: 'awaiting_approval', totalSteps: step + 1, totalDurationMs: Date.now() - startTime };
        }

        const result = await this.executeToolWithRetries(tool, toolCall, task);
        result.idempotencyKey = toolCall.idempotencyKey;
        if (result.success) { this.idempotencyCache.set(toolCall.idempotencyKey, result); }

        if (!result.success) {
          consecutiveToolFailures++;
          if (consecutiveToolFailures >= 3) {
            await this.failTask(task.taskId, 'consecutive_tool_failures', '3 consecutive tool failures');
            await this.events.publish({ type: 'task.escalated', publisher: task.agentId, payload: { taskId: task.taskId, reason: 'consecutive_tool_failures' } as any, correlationId: traceId, founderId: task.founderId });
            return { taskId: task.taskId, status: 'failed', error: '3 consecutive tool failures', totalSteps: step + 1, totalDurationMs: Date.now() - startTime };
          }
          if (result.error && (result.error.includes('auth') || result.error.includes('connector') || result.error.includes('unauthorized') || result.error.includes('ECONNREFUSED'))) {
            await this.flagConnectorUnhealthy(tool.handler, task.agentId, result.error);
          }
        } else {
          consecutiveToolFailures = 0;
        }

        await this.recordStep(task.taskId, step + 1, 'tool_result', null, result.output || result.error, toolCall, result, undefined, result.durationMs);
        loopHistory.push({ role: 'assistant', content: response });
        loopHistory.push({ role: 'user', content: 'Tool ' + toolCall.name + ': ' + JSON.stringify(result.output || result.error) });
      }

      await this.failTask(task.taskId, 'max_steps_exceeded', 'Max steps exceeded (' + config.maxSteps + ')');
      await this.events.publish({ type: 'task.escalated', publisher: task.agentId, payload: { taskId: task.taskId, reason: 'max_steps' } as any, correlationId: traceId, founderId: task.founderId });
      return { taskId: task.taskId, status: 'failed', error: 'Max steps exceeded', totalSteps: config.maxSteps, totalDurationMs: Date.now() - startTime };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('Task ' + task.taskId + ' fatal: ' + msg);
      await this.failTask(task.taskId, 'fatal_error', msg);
      return { taskId: task.taskId, status: 'failed', error: msg, totalSteps: 0, totalDurationMs: Date.now() - startTime };
    }
  }

  // ─── Resume after approval ────────────────────────────────────────────

  async resumeAfterApproval(taskId: string, decision: 'approved' | 'rejected' | 'edited', editedAction?: string): Promise<ExecutionResult> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('Task not found');
    if (task.status !== 'AWAITING_APPROVAL') throw new Error('Task not awaiting approval');
    const steps = await this.prisma.taskStep.findMany({ where: { taskId }, orderBy: { stepNumber: 'asc' } });
    const loopHistory: Array<{ role: string; content: string }> = [{ role: 'user', content: task.goal || task.description }];
    for (const s of steps) {
      if (s.type === 'reasoning' || s.type === 'final_answer') loopHistory.push({ role: 'assistant', content: String(s.output || '') });
      else if (s.type === 'tool_result') loopHistory.push({ role: 'user', content: 'Tool result: ' + String(s.output || s.error || '') });
    }
    const msg = decision === 'rejected' ? 'Founder rejected. Consider alternatives.' : decision === 'edited' ? 'Founder approved with edits: ' + (editedAction || '') : 'Founder approved. Continue.';
    loopHistory.push({ role: 'user', content: msg });
    await this.prisma.task.update({ where: { id: taskId }, data: { status: 'RUNNING' } });
    return this.executeTask({ taskId, agentId: task.agentId || '', triggerType: 'orchestrator_assigned', goal: task.goal || task.description, contextRefs: task.contextRefs || [], riskTierHint: null, deadline: task.deadline || null, parentTaskId: task.parentTaskId || null, founderId: task.founderId, layer: task.layer, traceId: task.traceId || undefined }, { agentId: task.agentId || '', name: '', layer: task.layer, systemPrompt: '', model: task.modelOverride || MODEL_TIERS.DEFAULT, maxSteps: task.maxSteps, contextTokenBudget: 8000, toolIds: [] });
  }

  // ─── Auto-learn: write memory after task completion ────────────────────

  private async autoLearn(task: AgentTask, result: string): Promise<void> {
    // Don't write trivial or error results
    if (result.length < 50) return;
    // Don't write for system-triggered scheduled tasks
    if (task.triggerType === 'scheduled') return;

    await this.memory.writeMemory({
      founderId: task.founderId,
      memoryType: 'business_fact',
      content: 'Task completed by ' + task.agentId + ' (' + task.layer + '): ' + task.goal.substring(0, 100) + ' — Result: ' + result.substring(0, 300),
      confidence: 'inferred',
      layer: task.layer as any,
      sourceAgentId: task.agentId,
      sourceTaskId: task.taskId,
      sourceTraceId: task.traceId,
    }).catch((e) => this.logger.verbose('Auto-learn skipped: ' + String(e)));
  }

  // ─── Prompt builder ───────────────────────────────────────────────────

  private buildPrompt(history: Array<{ role: string; content: string }>): string {
    return history.map(h => '[' + h.role + ']: ' + h.content).join(String.fromCharCode(10));
  }

  // ─── Tool call parser (improved) ──────────────────────────────────────

  private parseToolCall(response: string): ToolCall | null {
    // Try structured JSON tool call first
    const toolCallMatch = response.match(/\{"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[^}]*\})\s*\}/);
    if (toolCallMatch) {
      try {
        return { id: uuidv4(), name: toolCallMatch[1], arguments: JSON.parse(toolCallMatch[2]) };
      } catch { /* fall through */ }
    }

    // Fallback: just extract tool name from JSON object
    const nameMatch = response.match(/\{\s*"name"\s*:\s*"([^"\s]+)"/);
    if (nameMatch) {
      try {
        const fullJson = response.match(/\{[\s\S]*\}/);
        const args = fullJson ? JSON.parse(fullJson[0]) : {};
        const { name, ...rest } = args;
        return { id: uuidv4(), name: nameMatch[1], arguments: rest };
      } catch {
        return { id: uuidv4(), name: nameMatch[1], arguments: {} };
      }
    }
    return null;
  }

  // ─── Tool execution with retries ──────────────────────────────────────

  private async executeToolWithRetries(tool: any, call: ToolCall, task: AgentTask): Promise<ToolResult> {
    const start = Date.now();
    let lastError = '';
    for (let i = 0; i < tool.maxRetries; i++) {
      try {
        const r = await Promise.race([
          this.executeToolHandler(tool, call, task),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('Tool timeout')), tool.timeoutMs)),
        ]);
        return { success: true, output: r, durationMs: Date.now() - start };
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        this.logger.warn('Tool ' + tool.name + ' attempt ' + (i + 1) + ' failed: ' + lastError);
        if (i < tool.maxRetries - 1) await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
      }
    }
    return { success: false, error: lastError, durationMs: Date.now() - start };
  }

  // ─── Tool handler router ──────────────────────────────────────────────

  private async executeToolHandler(tool: any, call: ToolCall, task: AgentTask): Promise<any> {
    const parts = (tool.handler as string).split(':');
    const ht = parts[0];
    const hid = parts[1];

    if (ht === 'internal') {
      return this.executeInternalTool(hid, call, task);
    }

    // MCP connector execution
    if (ht === 'mcp') {
      const connectorId = hid;
      const connectorConf = getConnectorConfig(connectorId);
      if (!connectorConf) return { error: 'Unknown connector: ' + connectorId };

      const connInstance = await this.prisma.connector.findFirst({
        where: { connectorName: connectorId, founderId: task.founderId },
      });
      if (!connInstance || connInstance.status !== 'CONNECTED') {
        return { error: 'Connector ' + connectorId + ' is not connected. Please configure it in Settings.' };
      }

      const authMetadata = (connInstance.authMetadata as Record<string, any>) || {};
      const authHeader = this.buildAuthHeader(connectorConf.authType, authMetadata);
      this.mcpExecutor.registerConnector(connectorId, { baseUrl: connectorConf.baseUrl, authHeader, timeoutMs: 30000 });
      const result = await this.mcpExecutor.execute(tool.handler, call);
      return result.output || { error: result.error };
    }

    return { error: 'Unknown handler type: ' + ht };
  }

  // ─── Internal tool executor ───────────────────────────────────────────

  private async executeInternalTool(handlerId: string, call: ToolCall, task: AgentTask): Promise<any> {
    switch (handlerId) {
      case 'context_query': {
        const notes = await this.context.queryContext(task.founderId, call.arguments.query as string || '');
        return { results: notes.map((n: any) => ({ category: n.category, content: n.content, updatedAt: n.updatedAt })), count: notes.length };
      }

      case 'memory_write': {
        const mem = await this.memory.writeMemory({
          founderId: task.founderId,
          memoryType: (call.arguments.memoryType as any) || 'business_fact',
          content: call.arguments.content as string,
          confidence: (call.arguments.confidence as any) || 'inferred',
          layer: (call.arguments.layer as any) || task.layer,
          sourceAgentId: task.agentId,
          sourceTaskId: task.taskId,
          sourceTraceId: task.traceId,
        });
        return { memoryId: mem.id, status: 'written', memoryType: mem.memoryType };
      }

      case 'task_decompose': {
        const subtasks = (call.arguments.subtasks as any[]) || [];
        const created = [];
        for (const st of subtasks) {
          const taskId = v4();
          await this.prisma.task.create({
            data: {
              id: taskId, agentId: st.agentId, founderId: task.founderId, layer: st.layer || task.layer,
              title: st.goal.substring(0, 120), description: st.goal, goal: st.goal,
              triggerType: 'orchestrator_assigned', status: 'PENDING',
              riskTier: st.priority === 'HIGH' ? 'NOTIFY_AND_ACT' : 'AUTO_EXECUTE',
              parentTaskId: task.taskId, maxSteps: 8,
            },
          });
          created.push({ taskId, agentId: st.agentId, goal: st.goal });
        }
        return { decomposed: true, subtasks: created, count: created.length };
      }

      case 'schedule': {
        const runAt = call.arguments.runAt as string;
        const goal = call.arguments.goal as string;
        const agentId = call.arguments.agentId as string;
        const layer = call.arguments.layer as string;
        const recurring = call.arguments.recurring as boolean;

        const scheduledTask = await this.prisma.scheduledAction.create({
          data: {
            id: v4(), founderId: task.founderId, agentId, layer, goal,
            cronExpression: recurring ? runAt : null,
            runAt: recurring ? null : new Date(runAt),
            recurring: recurring || false,
            status: 'PENDING',
          },
        });
        return { scheduled: true, actionId: scheduledTask.id, runAt, recurring };
      }

      case 'delegate': {
        const targetAgentId = call.arguments.targetAgentId as string;
        const goal = call.arguments.goal as string;
        const context = (call.arguments.context as string) || '';
        const taskId = v4();

        // Create the delegated task
        await this.prisma.task.create({
          data: {
            id: taskId, agentId: targetAgentId, founderId: task.founderId, layer: task.layer,
            title: goal.substring(0, 120), description: goal, goal,
            triggerType: 'orchestrator_assigned', status: 'PENDING',
            riskTier: 'NOTIFY_AND_ACT', parentTaskId: task.taskId, maxSteps: 8,
          },
        });

        // Fire and forget — delegate in background
        this.executeTask({
          taskId, agentId: targetAgentId, triggerType: 'event_triggered',
          goal: context ? goal + '\n\nContext from ' + task.agentId + ': ' + context : goal,
          contextRefs: [], riskTierHint: null, deadline: null,
          parentTaskId: task.taskId, founderId: task.founderId, layer: task.layer,
        }, {
          agentId: targetAgentId, name: targetAgentId, layer: task.layer,
          systemPrompt: '', model: MODEL_TIERS.DEFAULT, maxSteps: 8,
          contextTokenBudget: 8000, toolIds: [],
        }).catch((e) => this.logger.error('Delegation failed: ' + String(e)));

        return { delegated: true, targetAgentId, taskId, goal };
      }

      case 'notify': {
        const message = call.arguments.message as string;
        const urgency = (call.arguments.urgency as string) || 'medium';
        await this.activity.logActivity({
          founderId: task.founderId, type: 'AGENT_NOTIFICATION',
          description: '[' + urgency.toUpperCase() + '] ' + message,
          agentId: task.agentId,
        });
        await this.events.publish({
          type: 'notification.' + urgency, publisher: task.agentId,
          payload: { message, urgency, taskId: task.taskId, actionUrl: call.arguments.actionUrl } as any,
          correlationId: task.traceId, founderId: task.founderId,
        });
        return { notified: true, urgency };
      }

      case 'email': {
        const connInstance = await this.prisma.connector.findFirst({
          where: { connectorName: 'mailchimp', founderId: task.founderId },
        });
        if (!connInstance || connInstance.status !== 'CONNECTED') {
          return { error: 'Email connector not configured. Connect an email service in Settings.' };
        }
        // Log the email as an activity (actual send via MCP connector)
        await this.activity.logActivity({
          founderId: task.founderId, type: 'EMAIL_QUEUED',
          description: 'Email to ' + call.arguments.to + ': ' + call.arguments.subject,
          agentId: task.agentId,
        });
        return { queued: true, to: call.arguments.to, subject: call.arguments.subject, note: 'Email queued. Actual sending requires email connector.' };
      }

      case 'social_post': {
        const platform = call.arguments.platform as string;
        const content = call.arguments.content as string;
        await this.activity.logActivity({
          founderId: task.founderId, type: 'SOCIAL_POST_DRAFTED',
          description: 'Draft ' + platform + ' post: ' + content.substring(0, 100),
          agentId: task.agentId,
        });
        return { drafted: true, platform, content, status: 'awaiting_approval', note: 'Post drafted. Requires founder approval before publishing.' };
      }

      case 'analyze': {
        const data = call.arguments.data;
        const analysisType = call.arguments.analysisType as string;
        const question = call.arguments.question as string;

        // Use LLM to analyze the data
        const analysis = await this.llm.complete({
          prompt: 'Analyze the following data and answer: ' + question + '\n\nData:\n' + JSON.stringify(data, null, 2),
          system: 'You are a data analyst. Provide clear, quantitative analysis. Include specific numbers, percentages, and comparisons.',
          maxTokens: 1500,
        });
        return { analysis, analysisType, question };
      }

      case 'web_search': {
        const query = call.arguments.query as string;
        // Use DuckDuckGo Lite (no API key needed)
        try {
          const url = 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(query);
          const response = await fetch(url, {
            headers: { 'User-Agent': 'Helm-AI-Agent/1.0' },
          });
          const html = await response.text();
          // Extract text content (basic scraping)
          const textContent = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .substring(0, 5000);
          return { query, results: textContent, source: 'duckduckgo' };
        } catch (e) {
          // Fallback: use LLM knowledge
          const knowledge = await this.llm.complete({
            prompt: 'Based on your training knowledge, answer this search query: ' + query + '. Note: this is from training data, not live search.',
            system: 'Provide factual information. Clearly state if information may be outdated.',
            maxTokens: 1000,
          });
          return { query, results: knowledge, source: 'llm_knowledge', note: 'Results from training data, not live search' };
        }
      }

      case 'documents': {
        const query = call.arguments.query as string;
        const notes = await this.context.queryContext(task.founderId, query);
        return { documents: notes.map((n: any) => ({ id: n.id, category: n.category, content: n.content })), count: notes.length };
      }

      case 'activity_read': {
        const limit = (call.arguments.limit as number) || 10;
        const logs = await this.activity.getActivityFeed(task.founderId, {
          agentId: call.arguments.agentId as string,
          type: call.arguments.type as string,
          limit,
        });
        return { activities: logs.items.map((l: any) => ({ type: l.type, description: l.description, agentId: l.agentId, timestamp: l.timestamp })), total: logs.total };
      }

      case 'task_status': {
        if (call.arguments.taskId) {
          const t = await this.prisma.task.findFirst({ where: { id: call.arguments.taskId as string, founderId: task.founderId } });
          return t ? { taskId: t.id, status: t.status, result: t.result, error: t.error, agentId: t.agentId, layer: t.layer } : { error: 'Task not found' };
        }
        const status = (call.arguments.status as string) || 'RUNNING';
        const tasks = await this.prisma.task.findMany({
          where: { founderId: task.founderId, status },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
        return { tasks: tasks.map(t => ({ taskId: t.id, status: t.status, title: t.title, agentId: t.agentId, layer: t.layer })), count: tasks.length };
      }

      case 'events':
        await this.events.publish({
          type: String(call.arguments.type),
          publisher: task.agentId,
          payload: call.arguments.payload as any,
          correlationId: task.traceId,
          founderId: task.founderId,
        });
        return { published: true };

      case 'approvals':
        return { note: 'Via risk gate' };

      default:
        return { error: 'Unknown internal handler: ' + handlerId };
    }
  }

  // ─── Auth header builder ──────────────────────────────────────────────

  private buildAuthHeader(authType: string, metadata: Record<string, any>): string {
    switch (authType) {
      case 'BEARER': return 'Bearer ' + (metadata.accessToken || metadata.token || '');
      case 'BASIC': {
        const key = metadata.apiKey || metadata.key || '';
        const secret = metadata.apiSecret || metadata.secret || '';
        return 'Basic ' + Buffer.from(key + ':' + secret).toString('base64');
      }
      case 'API_KEY': return 'X-API-Key ' + (metadata.apiKey || metadata.key || '');
      case 'OAUTH': return 'Bearer ' + (metadata.accessToken || '');
      default: return '';
    }
  }

  // ─── Connector health flagging ────────────────────────────────────────

  private async flagConnectorUnhealthy(handler: string, agentId: string, error: string): Promise<void> {
    const connName = handler.replace('mcp:', '');
    try {
      const existing = await this.prisma.connector.findFirst({ where: { connectorName: connName } });
      if (existing) await this.prisma.connector.update({ where: { id: existing.id }, data: { status: 'DISCONNECTED' } });
    } catch (e) { this.logger.warn('Could not flag connector: ' + String(e)); }
    await this.activity.logActivity({ founderId: '', type: 'CONNECTOR_ERROR', description: 'Connector ' + connName + ' unhealthy: ' + error });
    await this.events.publish({ type: 'connector.unhealthy', publisher: agentId, payload: { connector: connName, error } as any });
  }

  // ─── DB helpers ───────────────────────────────────────────────────────

  private async recordStep(taskId: string, step: number, type: StepType, input: any, output: any, toolCall: any, toolResult: any, error: string | undefined, durationMs: number): Promise<void> {
    await this.prisma.taskStep.create({ data: { taskId, stepNumber: step, type, input: input != null ? input as any : undefined, output: output != null ? output as any : undefined, toolCall: toolCall ? toolCall as any : undefined, toolResult: toolResult ? toolResult as any : undefined, error: error || undefined, durationMs } });
    await this.prisma.task.update({ where: { id: taskId }, data: { currentStep: step } });
  }

  private async completeTask(taskId: string, result: string): Promise<void> {
    await this.prisma.task.update({ where: { id: taskId }, data: { status: 'COMPLETED', result, completedAt: new Date() } });
  }

  private async failTask(taskId: string, _reason: string, desc: string): Promise<void> {
    await this.prisma.task.update({ where: { id: taskId }, data: { status: 'FAILED', error: desc, completedAt: new Date() } });
    this.logger.error('Task ' + taskId + ' failed: ' + desc);
  }

  private async notifyFounder(founderId: string, message: string, taskId: string): Promise<void> {
    await this.activity.logActivity({ founderId, type: 'TASK_FAILED', description: message });
    await this.events.publish({ type: 'task.failed', publisher: 'system', payload: { taskId, message } as any });
  }
}
