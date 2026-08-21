import { Injectable, Logger } from '@nestjs/common';
import { AgentRuntimeService } from '../../agent-runtime/agent-runtime.service';
import { ActivityService } from '../../activity/activity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuid } from 'uuid';
import { AgentConfig, MODEL_TIERS } from '../../agent-runtime/types';

@Injectable()
export class FinanceLayerService {
  private readonly logger = new Logger(FinanceLayerService.name);

  constructor(
    private runtime: AgentRuntimeService,
    private activity: ActivityService,
    private prisma: PrismaService,
  ) {}

  private readonly SUB_AGENTS = [
    { id: 'bookkeeping', keywords: ['bookkeep', 'invoice', 'receipt', 'transaction', 'categorize', 'reconcile'] },
    { id: 'cashflow-forecasting', keywords: ['cash', 'revenue', 'pnl', 'burn', 'runway', 'forecast', 'cashflow'] },
    { id: 'pricing-unit-economics', keywords: ['pricing', 'margin', 'unit economics', 'cac', 'ltv', 'profitability'] },
    { id: 'compliance-tax', keywords: ['gst', 'tax', 'compliance', 'regulatory', 'filing', 'deadline'] },
    { id: 'fundraising-investor-relations', keywords: ['investor', 'fundraising', 'pitch', 'funding', 'raise'] },
  ];

  private selectAgent(message: string): string {
    const lower = message.toLowerCase();
    for (const agent of this.SUB_AGENTS) {
      if (agent.keywords.some((kw) => lower.includes(kw))) return agent.id;
    }
    return 'bookkeeping';
  }

  private async dispatch(founderId: string, agentId: string, goal: string, routing: any): Promise<any> {
    const taskId = uuid();
    const agentDef: AgentConfig = {
      agentId, name: agentId, layer: 'FINANCE',
      systemPrompt: 'You are a finance agent for a solo founder business. Handle bookkeeping, invoicing, cash flow analysis, and compliance with precision. Financial accuracy is critical. Use tools to query context, analyze data, and write important financial insights to memory.',
      model: MODEL_TIERS.FINANCE, maxSteps: 10, contextTokenBudget: 8000, toolIds: [],
    };
    await this.prisma.task.create({
      data: {
        id: taskId, agentId, founderId, layer: 'FINANCE',
        title: goal.substring(0, 120), description: goal, goal,
        triggerType: 'orchestrator_assigned', status: 'PENDING',
        riskTier: 'APPROVAL_REQUIRED', maxSteps: 10,
      },
    });
    await this.activity.logActivity({ founderId, type: 'TASK_STARTED', description: 'Finance: ' + goal.substring(0, 80) });
    this.runtime.executeTask({
      taskId, agentId, triggerType: 'orchestrator_assigned', goal,
      contextRefs: routing?.contextRefs || [], riskTierHint: 'APPROVAL_REQUIRED' as any,
      deadline: null, parentTaskId: routing?.parentTaskId || null,
      founderId, layer: 'FINANCE',
    }, agentDef).catch(e => this.activity.logActivity({ founderId, type: 'TASK_FAILED', description: 'Finance task failed: ' + String(e) }));
    return {
      content: '**Finance Layer** 💰\n\nTask dispatched to ' + agentId + '. Tracking: ' + taskId.substring(0, 8) + '...\n\nNote: Financial actions require your approval before execution.\n\nWorking on: ' + goal,
      metadata: { taskId, subAgent: agentId },
    };
  }

  async handleMessage(founderId: string, message: string, routing: any) {
    const agentId = routing.agentId || this.selectAgent(message);
    return this.dispatch(founderId, agentId, message, routing);
  }
}
