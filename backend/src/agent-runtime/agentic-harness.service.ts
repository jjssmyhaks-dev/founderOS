import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { AgentRuntimeService } from './agent-runtime.service';
import { GuardrailsService } from '../guardrails/guardrails.service';
import { SelfImprovementService } from './self-improvement.service';
import { EvalEnhancedService } from '../observability/eval-enhanced.service';
import { AgentConfig, MODEL_TIERS, ExecutionResult } from './types';
import { AGENT_REGISTRY } from '../agents/agents.service';

interface QueuedTask {
  taskId: string;
  agentId: string;
  founderId: string;
  layer: string;
  goal: string;
  priority: number; // 1=highest, 5=lowest
  enqueuedAt: Date;
  resolve: (result: ExecutionResult) => void;
  reject: (error: Error) => void;
}

interface AgentSlot {
  agentId: string;
  taskId: string;
  startedAt: Date;
  timeoutMs: number;
}

@Injectable()
export class AgenticHarnessService {
  private readonly logger = new Logger(AgenticHarnessService.name);

  // Concurrency control
  private readonly MAX_CONCURRENT_GLOBAL = 10;   // Max 10 agents running at once
  private readonly MAX_CONCURRENT_PER_AGENT = 2;  // Max 2 tasks per agent
  private readonly MAX_TASK_TIMEOUT_MS = 300000;  // 5 minutes max per task
  private readonly QUEUE_MAX_SIZE = 100;

  private activeSlots = new Map<string, AgentSlot[]>(); // agentId → slots
  private globalActive = 0;
  private taskQueue: QueuedTask[] = [];
  private degradationMode = false;

  constructor(
    private prisma: PrismaService,
    private events: EventService,
    private runtime: AgentRuntimeService,
    private guardrails: GuardrailsService,
    private selfImprovement: SelfImprovementService,
    private evalService: EvalEnhancedService,
  ) {}

  // ─── Task Submission (the main entry point) ───────────────────────────

  async submitTask(params: {
    agentId: string;
    founderId: string;
    goal: string;
    layer: string;
    priority?: number;
    deadline?: Date;
    parentTaskId?: string;
    traceId?: string;
  }): Promise<ExecutionResult> {
    const { agentId, founderId, goal, layer, priority = 3, deadline, parentTaskId, traceId } = params;

    // 1. Guardrail checks on input
    const inputCheck = await this.guardrails.checkInput(goal, agentId, founderId);
    if (inputCheck.blocked) {
      return { taskId: '', status: 'failed', error: inputCheck.reason || 'Input blocked by guardrails', totalSteps: 0, totalDurationMs: 0 };
    }
    const sanitizedGoal = inputCheck.sanitized || goal;

    // 2. Budget check
    const budgetCheck = await this.guardrails.checkBudget(agentId, founderId);
    if (!budgetCheck.allowed) {
      return { taskId: '', status: 'failed', error: budgetCheck.reason || 'Budget exceeded', totalSteps: 0, totalDurationMs: 0 };
    }

    // 3. Check if we can run immediately or need to queue
    const canRunNow = this.canAllocateSlot(agentId);

    if (canRunNow) {
      return this.executeWithHarness({
        agentId, founderId, goal: sanitizedGoal, layer, priority,
        deadline, parentTaskId, traceId,
      });
    }

    // 4. Queue the task
    if (this.taskQueue.length >= this.QUEUE_MAX_SIZE) {
      return { taskId: '', status: 'failed', error: 'Task queue full', totalSteps: 0, totalDurationMs: 0 };
    }

    return new Promise((resolve, reject) => {
      this.taskQueue.push({
        taskId: uuid(), agentId, founderId, layer,
        goal: sanitizedGoal, priority,
        enqueuedAt: new Date(),
        resolve, reject,
      });
      this.taskQueue.sort((a, b) => a.priority - b.priority || a.enqueuedAt.getTime() - b.enqueuedAt.getTime());
      this.logger.log('Task queued: ' + agentId + ' (queue size: ' + this.taskQueue.length + ')');
    });
  }

  // ─── Execute with Harness Controls ────────────────────────────────────

  private async executeWithHarness(params: {
    agentId: string;
    founderId: string;
    goal: string;
    layer: string;
    priority: number;
    deadline?: Date;
    parentTaskId?: string;
    traceId?: string;
  }): Promise<ExecutionResult> {
    const { agentId, founderId, goal, layer, deadline, parentTaskId, traceId } = params;
    const taskId = uuid();
    const startTime = Date.now();

    // Allocate slot
    this.allocateSlot(agentId, taskId);

    try {
      // Create task in DB
      await this.prisma.task.create({
        data: {
          id: taskId, agentId, founderId, layer,
          title: goal.substring(0, 120), description: goal, goal,
          triggerType: 'orchestrator_assigned', status: 'PENDING',
          riskTier: layer === 'FINANCE' ? 'APPROVAL_REQUIRED' : 'NOTIFY_AND_ACT',
          maxSteps: 10, parentTaskId: parentTaskId || null,
        },
      });

      const agentDef = AGENT_REGISTRY.find(a => a.id === agentId);
      const config: AgentConfig = {
        agentId, name: agentDef?.name || agentId, layer,
        systemPrompt: agentDef?.responsibility || '',
        model: MODEL_TIERS.DEFAULT,
        maxSteps: 10,
        contextTokenBudget: 8000,
        toolIds: [],
      };

      // Execute with timeout
      const result = await Promise.race([
        this.runtime.executeTask({
          taskId, agentId, triggerType: 'orchestrator_assigned', goal,
          contextRefs: [], riskTierHint: null,
          deadline: deadline || new Date(Date.now() + this.MAX_TASK_TIMEOUT_MS),
          parentTaskId: parentTaskId || null,
          founderId, layer, traceId,
        }, config),
        this.timeout(this.MAX_TASK_TIMEOUT_MS, taskId),
      ]);

      // Post-execution: output guardrails
      if (result.result) {
        const outputCheck = await this.guardrails.checkOutput(result.result, agentId, founderId, taskId);
        if (outputCheck.sanitized) {
          result.result = outputCheck.sanitized;
        }
      }

      // Record usage for budget
      await this.guardrails.recordUsage(agentId, founderId, result.totalSteps * 500, Math.ceil(result.totalSteps * 0.1));

      // Self-improvement: learn from outcome
      await this.selfImprovement.learnFromOutcome({
        taskId, agentId, founderId,
        status: result.status, goal, result: result.result, error: result.error,
        stepsCount: result.totalSteps,
        toolsUsed: [], // Would need to extract from steps
        durationMs: result.totalDurationMs,
        tokenEstimate: result.totalSteps * 500,
      }).catch(e => this.logger.verbose('Self-improvement skipped: ' + String(e)));

      // Auto-eval on completion (sample 20% of tasks)
      if (result.status === 'completed' && Math.random() < 0.2) {
        this.evalService.evaluateTask(taskId).catch(e =>
          this.logger.verbose('Auto-eval skipped: ' + String(e)),
        );
      }

      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { taskId, status: 'failed', error: msg, totalSteps: 0, totalDurationMs: Date.now() - startTime };
    } finally {
      this.releaseSlot(agentId, taskId);
      this.processQueue(); // Try to run next queued task
    }
  }

  // ─── Slot Management ──────────────────────────────────────────────────

  private canAllocateSlot(agentId: string): boolean {
    if (this.globalActive >= this.MAX_CONCURRENT_GLOBAL) return false;
    const agentSlots = this.activeSlots.get(agentId) || [];
    if (agentSlots.length >= this.MAX_CONCURRENT_PER_AGENT) return false;
    return true;
  }

  private allocateSlot(agentId: string, taskId: string): void {
    const slots = this.activeSlots.get(agentId) || [];
    slots.push({ agentId, taskId, startedAt: new Date(), timeoutMs: this.MAX_TASK_TIMEOUT_MS });
    this.activeSlots.set(agentId, slots);
    this.globalActive++;
  }

  private releaseSlot(agentId: string, taskId: string): void {
    const slots = this.activeSlots.get(agentId) || [];
    this.activeSlots.set(agentId, slots.filter(s => s.taskId !== taskId));
    this.globalActive = Math.max(0, this.globalActive - 1);
  }

  // ─── Queue Processing ─────────────────────────────────────────────────

  private processQueue(): void {
    while (this.taskQueue.length > 0) {
      const next = this.taskQueue[0];
      if (!this.canAllocateSlot(next.agentId)) break;

      this.taskQueue.shift();
      this.executeWithHarness({
        agentId: next.agentId, founderId: next.founderId,
        goal: next.goal, layer: next.layer, priority: next.priority,
      }).then(next.resolve).catch(next.reject);
    }
  }

  // ─── Degradation Mode ─────────────────────────────────────────────────

  async enableDegradationMode(reason: string): Promise<void> {
    this.degradationMode = true;
    this.logger.warn('Degradation mode enabled: ' + reason);

    // Fail all queued tasks gracefully
    while (this.taskQueue.length > 0) {
      const queued = this.taskQueue.shift()!;
      queued.resolve({
        taskId: queued.taskId, status: 'failed',
        error: 'System in degradation mode: ' + reason,
        totalSteps: 0, totalDurationMs: 0,
      });
    }

    await this.events.publish({
      type: 'system.degradation_enabled', publisher: 'harness',
      payload: { reason, activeSlots: this.globalActive, queued: this.taskQueue.length } as any,
    });
  }

  disableDegradationMode(): void {
    this.degradationMode = false;
    this.logger.log('Degradation mode disabled');
    this.processQueue();
  }

  // ─── Timeout Helper ───────────────────────────────────────────────────

  private timeout(ms: number, taskId: string): Promise<ExecutionResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Task timeout after ' + ms + 'ms'));
      }, ms);
    });
  }

  // ─── Status API ───────────────────────────────────────────────────────

  getHarnessStatus() {
    const activeTasks: any[] = [];
    for (const [agentId, slots] of this.activeSlots) {
      for (const slot of slots) {
        activeTasks.push({
          agentId, taskId: slot.taskId,
          startedAt: slot.startedAt,
          durationMs: Date.now() - slot.startedAt.getTime(),
        });
      }
    }

    return {
      globalActive: this.globalActive,
      maxConcurrent: this.MAX_CONCURRENT_GLOBAL,
      queued: this.taskQueue.length,
      degradationMode: this.degradationMode,
      activeTasks,
      queuePreview: this.taskQueue.slice(0, 10).map(t => ({
        agentId: t.agentId, goal: t.goal.substring(0, 60),
        priority: t.priority, enqueuedAt: t.enqueuedAt,
      })),
    };
  }

  getAgentStatus(agentId: string) {
    const slots = this.activeSlots.get(agentId) || [];
    return {
      agentId,
      activeTasks: slots.length,
      maxConcurrent: this.MAX_CONCURRENT_PER_AGENT,
      tasks: slots.map(s => ({ taskId: s.taskId, durationMs: Date.now() - s.startedAt.getTime() })),
    };
  }
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
