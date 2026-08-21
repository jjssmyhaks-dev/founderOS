import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { EventService } from '../events/events.service';
import { MemoryService } from '../memory/memory.service';
import { v4 } from 'uuid';

interface TaskOutcome {
  taskId: string;
  agentId: string;
  founderId: string;
  status: string;
  goal: string;
  result?: string;
  error?: string;
  stepsCount: number;
  toolsUsed: string[];
  durationMs: number;
  tokenEstimate: number;
}

@Injectable()
export class SelfImprovementService {
  private readonly logger = new Logger(SelfImprovementService.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmService,
    private events: EventService,
    private memory: MemoryService,
  ) {}

  // ─── Learn from Task Outcome ──────────────────────────────────────────

  async learnFromOutcome(outcome: TaskOutcome): Promise<void> {
    // 1. Update agent performance stats
    await this.recordPerformance(outcome);

    // 2. Analyze what went right/wrong and write lessons to memory
    if (outcome.status === 'FAILED') {
      await this.learnFromFailure(outcome);
    } else if (outcome.status === 'completed') {
      await this.learnFromSuccess(outcome);
    }

    // 3. Update working memory for the agent
    await this.updateWorkingMemory(outcome);

    this.logger.log('Self-improvement: learned from task ' + outcome.taskId + ' (' + outcome.status + ')');
  }

  // ─── Learn from Failure ───────────────────────────────────────────────

  private async learnFromFailure(outcome: TaskOutcome): Promise<void> {
    const lesson = `Task "${outcome.goal.substring(0, 100)}" failed with error: ${outcome.error || 'unknown'}. Tools used: ${outcome.toolsUsed.join(', ')}. Duration: ${outcome.durationMs}ms.`;

    // Write failure lesson to memory
    await this.memory.writeMemory({
      founderId: outcome.founderId,
      memoryType: 'decision_log',
      content: `LESSON (from failure): ${lesson}`,
      confidence: 'confirmed',
      layer: null,
      sourceAgentId: outcome.agentId,
      sourceTaskId: outcome.taskId,
    }).catch(() => {});

    // Check for error patterns and suggest improvements
    const recentFailures = await this.prisma.task.findMany({
      where: { agentId: outcome.agentId, status: 'FAILED' },
      orderBy: { createdAt: 'desc' }, take: 5,
    });

    if (recentFailures.length >= 3) {
      // Pattern detected — suggest improvement
      const errorPattern = recentFailures.map(f => f.error).filter(Boolean);
      await this.suggestImprovement(outcome.agentId, 'error_pattern', {
        errors: errorPattern,
        suggestion: 'Agent has repeated failures. Consider adjusting approach or maxSteps.',
      });
    }
  }

  // ─── Learn from Success ───────────────────────────────────────────────

  private async learnFromSuccess(outcome: TaskOutcome): Promise<void> {
    if (!outcome.result || outcome.result.length < 50) return;

    // Analyze what approach worked
    const steps = await this.prisma.taskStep.findMany({
      where: { taskId: outcome.taskId }, orderBy: { stepNumber: 'asc' },
    });

    const toolSequence = steps.filter(s => s.type === 'tool_call').map(s => (s.toolCall as any)?.name).filter(Boolean);

    if (toolSequence.length > 0) {
      // Write successful pattern to memory
      await this.memory.writeMemory({
        founderId: outcome.founderId,
        memoryType: 'business_fact',
        content: `SUCCESSFUL APPROACH for "${outcome.goal.substring(0, 80)}": Used tools in sequence [${toolSequence.join(' → ')}]. Result was accepted.`,
        confidence: 'inferred',
        sourceAgentId: outcome.agentId,
        sourceTaskId: outcome.taskId,
      }).catch(() => {});
    }
  }

  // ─── Record Performance Metrics ───────────────────────────────────────

  private async recordPerformance(outcome: TaskOutcome): Promise<void> {
    // Aggregate performance for the agent
    const now = new Date();
    const periodStart = new Date(now.getTime() - 7 * 86400000); // Last 7 days

    const recentTasks = await this.prisma.task.findMany({
      where: { agentId: outcome.agentId, createdAt: { gte: periodStart } },
    });

    const completed = recentTasks.filter(t => t.status === 'COMPLETED').length;
    const failed = recentTasks.filter(t => t.status === 'FAILED').length;
    const total = recentTasks.length;

    // Tool usage stats
    const toolUsage: Record<string, { count: number; successes: number }> = {};
    for (const task of recentTasks.slice(0, 50)) {
      const steps = await this.prisma.taskStep.findMany({
        where: { taskId: task.id, type: 'tool_call' },
      });
      for (const step of steps) {
        const toolName = (step.toolCall as any)?.name || 'unknown';
        if (!toolUsage[toolName]) toolUsage[toolName] = { count: 0, successes: 0 };
        toolUsage[toolName].count++;
        if (task.status === 'COMPLETED') toolUsage[toolName].successes++;
      }
    }

    // Upsert performance record
    await this.prisma.agentPerformance.upsert({
      where: { agentId_period_measuredAt: { agentId: outcome.agentId, period: '7d', measuredAt: periodStart } },
      create: {
        agentId: outcome.agentId, period: '7d',
        totalTasks: total, completedTasks: completed, failedTasks: failed,
        avgDurationMs: total > 0 ? recentTasks.reduce((a, t) => a + ((t as any).durationMs || 0), 0) / total : 0,
        avgSteps: total > 0 ? recentTasks.reduce((a, t) => a + (t.maxSteps || 0), 0) / total : 0,
        toolUsageStats: toolUsage as any,
        improvementNotes: await this.generateImprovementNotes(outcome.agentId, completed, failed, toolUsage),
      },
      update: {
        totalTasks: total, completedTasks: completed, failedTasks: failed,
        toolUsageStats: toolUsage as any,
        improvementNotes: await this.generateImprovementNotes(outcome.agentId, completed, failed, toolUsage),
      },
    });
  }

  // ─── Generate Improvement Notes ───────────────────────────────────────

  private async generateImprovementNotes(
    agentId: string, completed: number, failed: number,
    toolUsage: Record<string, { count: number; successes: number }>,
  ): Promise<string> {
    const reliability = completed + failed > 0 ? Math.round((completed / (completed + failed)) * 100) : 100;
    const toolEntries = Object.entries(toolUsage);
    const underusedTools = toolEntries.filter(([_, stats]) => stats.count < 2).map(([name]) => name);
    const failingTools = toolEntries.filter(([_, stats]) => stats.successes / Math.max(stats.count, 1) < 0.5).map(([name]) => name);

    const notes: string[] = [];
    if (reliability < 70) notes.push(`Reliability is ${reliability}% — review failure patterns.`);
    if (underusedTools.length > 0) notes.push(`Consider using: ${underusedTools.join(', ')}`);
    if (failingTools.length > 0) notes.push(`Tool failures: ${failingTools.join(', ')} — may need reconfiguration.`);
    if (completed > 20 && reliability > 90) notes.push('Strong performer — could handle higher maxSteps.');

    return notes.join(' | ') || 'Performance within normal parameters.';
  }

  // ─── Working Memory Management ────────────────────────────────────────

  private async updateWorkingMemory(outcome: TaskOutcome): Promise<void> {
    const state = await this.prisma.agentState.findFirst({
      where: { agentId: outcome.agentId, founderId: outcome.founderId },
    });

    const recentOutcomes = (state?.workingMemory as any)?.recentOutcomes || [];
    recentOutcomes.push({
      taskId: outcome.taskId,
      status: outcome.status,
      goal: outcome.goal.substring(0, 100),
      toolsUsed: outcome.toolsUsed,
      timestamp: new Date().toISOString(),
    });
    // Keep last 20 outcomes
    const trimmed = recentOutcomes.slice(-20);

    const learningQueue = (state?.learningQueue as any)?.items || [];
    if (outcome.status === 'FAILED') {
      learningQueue.push({
        type: 'failure_analysis',
        taskId: outcome.taskId,
        error: outcome.error,
        timestamp: new Date().toISOString(),
      });
    }
    const trimmedQueue = { items: learningQueue.slice(-10) };

    if (state) {
      await this.prisma.agentState.update({
        where: { id: state.id },
        data: { workingMemory: { recentOutcomes: trimmed }, learningQueue: trimmedQueue, lastActiveAt: new Date() },
      });
    } else {
      await this.prisma.agentState.create({
        data: {
          agentId: outcome.agentId, founderId: outcome.founderId,
          stateType: 'idle',
          workingMemory: { recentOutcomes: trimmed },
          learningQueue: trimmedQueue,
        },
      });
    }
  }

  // ─── Memory Consolidation ─────────────────────────────────────────────

  async consolidateMemory(founderId: string, agentId?: string): Promise<{ merged: number; archived: number }> {
    const startTime = Date.now();
    const where: any = { founderId, status: 'active' };
    if (agentId) where.sourceAgentId = agentId;

    const memories = await this.prisma.contextNote.findMany({ where, orderBy: { createdAt: 'asc' } });
    if (memories.length < 10) return { merged: 0, archived: 0 };

    // Group by memoryType
    const byType: Record<string, any[]> = {};
    for (const m of memories) {
      const key = m.memoryType || 'unknown';
      if (!byType[key]) byType[key] = [];
      byType[key].push(m);
    }

    let merged = 0;
    let archived = 0;

    for (const [type, typeMemories] of Object.entries(byType)) {
      if (typeMemories.length < 5) continue; // Only consolidate types with many entries

      // Use LLM to identify redundant/outdated memories
      const memoryTexts = typeMemories.map((m, i) => `${i}: [${m.confidence}] ${m.content}`).join('\n');
      try {
        const result = await this.llm.complete({
          prompt: `You are analyzing ${typeMemories.length} memories of type "${type}". Identify memories that are:
1. DUPLICATE (same information stated differently)
2. OUTDATED (superseded by newer information)
3. LOW_VALUE (not useful for decision making)

Return the indices of memories to ARCHIVE (remove from active), comma-separated.
If none should be archived, return "none".

Memories:\n${memoryTexts}`,
          system: 'Be concise. Return only comma-separated indices or "none".',
          maxTokens: 200,
        });

        if (result.trim() !== 'none') {
          const indices = result.split(',').map(s => parseInt(s.trim())).filter(i => !isNaN(i));
          for (const idx of indices) {
            if (idx < typeMemories.length) {
              await this.prisma.contextNote.update({
                where: { id: typeMemories[idx].id },
                data: { status: 'archived' },
              });
              archived++;
            }
          }
        }
      } catch (e) {
        this.logger.warn('Memory consolidation LLM call failed for type ' + type);
      }
    }

    // Record consolidation
    await this.prisma.memoryConsolidation.create({
      data: {
        founderId, agentId: agentId || 'global',
        triggerType: 'threshold',
        memoriesBefore: memories.length,
        memoriesAfter: memories.length - archived,
        merged, archived,
        durationMs: Date.now() - startTime,
      },
    });

    this.logger.log(`Memory consolidation: ${archived} archived, ${merged} merged (${Date.now() - startTime}ms)`);
    return { merged, archived };
  }

  // ─── Improvement Suggestions ──────────────────────────────────────────

  private async suggestImprovement(agentId: string, type: string, data: any): Promise<void> {
    await this.events.publish({
      type: 'agent.improvement_suggested', publisher: 'self-improvement',
      payload: { agentId, type, data } as any,
    });
  }

  // ─── Query API ────────────────────────────────────────────────────────

  async getAgentPerformance(agentId: string) {
    return this.prisma.agentPerformance.findMany({
      where: { agentId }, orderBy: { measuredAt: 'desc' }, take: 10,
    });
  }

  async getWorkingMemory(agentId: string, founderId: string) {
    return this.prisma.agentState.findFirst({ where: { agentId, founderId } });
  }

  async getConsolidationHistory(founderId: string, limit: number = 10) {
    return this.prisma.memoryConsolidation.findMany({
      where: { founderId }, orderBy: { createdAt: 'desc' }, take: limit,
    });
  }
}
