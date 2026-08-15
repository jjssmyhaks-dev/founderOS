import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { EventService } from '../events/events.service';
import { ActivityService } from '../activity/activity.service';
import { ToolRegistryService } from './tool-registry.service';
import { ContextAssemblerService } from './context-assembler.service';
import { RiskGateService } from './risk-gate.service';
import { McpConnectorExecutor } from './mcp-connector-executor.service';
import { AgentTask, AgentConfig, ExecutionResult, StepType, ToolCall, ToolResult, MODEL_TIERS } from './types';

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
  ) {}

  async executeTask(task: AgentTask, config: AgentConfig): Promise<ExecutionResult> {
    const startTime = Date.now();
    const traceId = task.traceId || uuidv4();
    this.logger.log('Starting task ' + task.taskId + ' for agent ' + task.agentId + ' trace=' + traceId);

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

        const toolCall = this.parseToolCall(response);

        if (!toolCall) {
          await this.recordStep(task.taskId, step, 'final_answer', response, null, null, null, undefined, Date.now() - stepStart);
          await this.completeTask(task.taskId, response);
          await this.activity.logActivity({ founderId: task.founderId, type: 'TASK_COMPLETED', description: 'Agent completed: ' + task.goal.substring(0, 100) });
          await this.events.publish({
            type: 'task.completed', publisher: task.agentId,
            payload: { taskId: task.taskId, result: response } as any,
            correlationId: traceId,
          });
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
          loopHistory.push({ role: 'user', content: 'Tool ' + toolCall.name + ': ' + JSON.stringify(cached.output) + ' (cached result)' });
          continue;
        }

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
            await this.events.publish({ type: 'task.escalated', publisher: task.agentId, payload: { taskId: task.taskId, reason: 'consecutive_tool_failures' } as any, correlationId: traceId });
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
      await this.events.publish({ type: 'task.escalated', publisher: task.agentId, payload: { taskId: task.taskId, reason: 'max_steps' } as any, correlationId: traceId });
      return { taskId: task.taskId, status: 'failed', error: 'Max steps exceeded', totalSteps: config.maxSteps, totalDurationMs: Date.now() - startTime };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error('Task ' + task.taskId + ' fatal: ' + msg);
      await this.failTask(task.taskId, 'fatal_error', msg);
      return { taskId: task.taskId, status: 'failed', error: msg, totalSteps: 0, totalDurationMs: Date.now() - startTime };
    }
  }

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

  private buildPrompt(history: Array<{ role: string; content: string }>): string {
    return history.map(h => '[' + h.role + ']: ' + h.content).join(String.fromCharCode(10));
  }

  private parseToolCall(response: string): ToolCall | null {
    const re = /\{\s*"name"\s*:\s*"([^"\s]+)"/;
    const match = response.match(re);
    if (!match) return null;
    try {
      const jm = response.match(/\{[^}]+\}/);
      const args = jm ? JSON.parse(jm[0]) : {};
      return { id: uuidv4(), name: match[1], arguments: args };
    } catch {
      return { id: uuidv4(), name: match[1], arguments: {} };
    }
  }

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

  private async executeToolHandler(tool: any, call: ToolCall, task: AgentTask): Promise<any> {
    const parts = (tool.handler as string).split(':');
    const ht = parts[0];
    const hid = parts[1];
    if (ht === 'internal') {
      if (hid === 'context') return { query: call.arguments.query };
      if (hid === 'events') { await this.events.publish({ type: String(call.arguments.type), publisher: task.agentId, payload: call.arguments.payload as any, correlationId: task.traceId }); return { published: true }; }
      if (hid === 'approvals') return { note: 'Via risk gate' };
      if (hid === 'activity') return { escalated: true };
      return { error: 'Unknown handler: ' + hid };
    }
    this.logger.warn('MCP ' + tool.handler + ' not yet implemented');
    return { note: 'MCP connector ' + tool.handler + ' not yet implemented' };
  }

  private async flagConnectorUnhealthy(handler: string, agentId: string, error: string): Promise<void> {
    const connName = handler.replace('mcp:', '');
    try {
      const existing = await this.prisma.connector.findFirst({ where: { connectorName: connName } });
      if (existing) await this.prisma.connector.update({ where: { id: existing.id }, data: { status: 'DISCONNECTED' } });
    } catch (e) { this.logger.warn('Could not flag connector: ' + String(e)); }
    await this.activity.logActivity({ founderId: '', type: 'CONNECTOR_ERROR', description: 'Connector ' + connName + ' unhealthy: ' + error });
    await this.events.publish({ type: 'connector.unhealthy', publisher: agentId, payload: { connector: connName, error } as any });
  }

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




