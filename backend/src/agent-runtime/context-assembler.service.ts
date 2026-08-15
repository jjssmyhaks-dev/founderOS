import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBudgetService } from './token-budget.service';
import { MemoryService } from '../memory/memory.service';
import { AgentTask, AgentConfig } from './types';

@Injectable()
export class ContextAssemblerService {
  private readonly logger = new Logger(ContextAssemblerService.name);
  constructor(
    private prisma: PrismaService,
    private tokenBudget: TokenBudgetService,
    private memory: MemoryService,
  ) {}

  async assemble(task: AgentTask, config: AgentConfig): Promise<string> {
    const parts: Array<{ content: string; priority: number }> = [];

    // Priority 0: system prompt (always included)
    if (config.systemPrompt) {
      parts.push({ content: config.systemPrompt, priority: 0 });
    }

    // Priority 1: task goal
    parts.push({ content: 'Goal: ' + task.goal + ' | Trace: ' + (task.traceId || task.taskId), priority: 1 });

    // Priority 2: memory retrieval (type-aware, boosted strategic_goal/constraint)
    const memories = await this.memory.retrieveMemory({
      founderId: task.founderId,
      query: task.goal,
      layer: (config.layer as any) || null,
      maxResults: 8,
    });
    if (memories.length > 0) {
      const memText = memories.map(m => {
        const conf = '[' + (m as any).confidence + '] ';
        const type = '[' + (m as any).memoryType + '] ';
        return type + conf + (m as any).content;
      }).join(String.fromCharCode(10));
      parts.push({ content: '--- MEMORY ---' + String.fromCharCode(10) + memText, priority: 2 });
    }

    // Priority 3: recent activity
    const recent = await this.prisma.activityLog.findMany({
      where: { agentId: task.agentId },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });
    if (recent.length > 0) {
      parts.push({ content: '--- RECENT ACTIVITY ---' + String.fromCharCode(10) + recent.map(e => '[' + e.type + '] ' + e.description).join(String.fromCharCode(10)), priority: 3 });
    }

    // Enforce token budget
    const enforced = this.tokenBudget.enforce(config.contextTokenBudget, parts);
    const sep = String.fromCharCode(10) + String.fromCharCode(10);
    const assembled = enforced.join(sep);

    const estimatedTokens = this.tokenBudget.estimateTokens(assembled);
    this.logger.verbose('Context: ' + assembled.length + ' chars (~' + estimatedTokens + '/' + config.contextTokenBudget + ' tokens) for task ' + task.taskId);
    return assembled;
  }
}
