import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenBudgetService } from './token-budget.service';
import { AgentTask, AgentConfig } from './types';

@Injectable()
export class ContextAssemblerService {
  private readonly logger = new Logger(ContextAssemblerService.name);
  constructor(
    private prisma: PrismaService,
    private tokenBudget: TokenBudgetService,
  ) {}

  async assemble(task: AgentTask, config: AgentConfig): Promise<string> {
    const parts: Array<{ content: string; priority: number }> = [];

    // Priority 0: system prompt (always included)
    if (config.systemPrompt) {
      parts.push({ content: config.systemPrompt, priority: 0 });
    }

    // Priority 1: task goal
    parts.push({ content: 'Goal: ' + task.goal + ' | Trace: ' + (task.traceId || task.taskId), priority: 1 });

    // Priority 2: relevant context notes
    if (task.contextRefs.length > 0) {
      const notes = await this.prisma.contextNote.findMany({
        where: { id: { in: task.contextRefs } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });
      if (notes.length > 0) {
        parts.push({ content: '--- RELEVANT CONTEXT ---' + String.fromCharCode(10) + notes.map(n => '[' + n.category + '] ' + n.content).join(String.fromCharCode(10)), priority: 2 });
      }
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
