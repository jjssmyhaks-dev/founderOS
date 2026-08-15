import { Injectable } from '@nestjs/common';
import { AgentRuntimeService } from '../../agent-runtime/agent-runtime.service';
import { ActivityService } from '../../activity/activity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuid } from 'uuid';
import { AgentConfig, MODEL_TIERS } from '../../agent-runtime/types';

@Injectable()
export class FinanceLayerService {
  constructor(
    private runtime: AgentRuntimeService,
    private activity: ActivityService,
    private prisma: PrismaService,
  ) {}

  private async dispatch(founderId: string, agentId: string, goal: string, routing: any): Promise<any> {
    const taskId = uuid();
    const agentDef: AgentConfig = {
      agentId, name: agentId, layer: 'FINANCE',
      systemPrompt: 'You are a finance agent. Handle bookkeeping, invoicing, and compliance with precision. Financial accuracy is critical.',
      model: MODEL_TIERS.FINANCE, maxSteps: 8, contextTokenBudget: 8000, toolIds: [],
    };
    await this.prisma.task.create({
      data: { id: taskId, agentId, founderId, layer: 'FINANCE', description: goal, goal, triggerType: 'orchestrator_assigned', status: 'PENDING', riskTier: 'APPROVAL_REQUIRED', maxSteps: 8 } as any,
    });
    await this.activity.logActivity({ founderId, type: 'TASK_STARTED', description: 'Finance: ' + goal.substring(0, 80) });
    this.runtime.executeTask({ taskId, agentId, triggerType: 'orchestrator_assigned', goal, contextRefs: routing?.contextRefs || [], riskTierHint: "APPROVAL_REQUIRED" as any, deadline: null, parentTaskId: routing?.parentTaskId || null, founderId, layer: 'FINANCE' }, agentDef).catch(e => this.activity.logActivity({ founderId, type: 'TASK_FAILED', description: 'Finance task failed: ' + String(e) }));
    return { content: '**Finance Layer** \ud83d\udcb0\n\nTask dispatched to ' + agentId + '. Tracking: ' + taskId.substring(0, 8) + '...\n\nNote: Financial actions require your approval before execution.\n\nWorking on: ' + goal, metadata: { taskId, subAgent: agentId } };
  }

  async handleMessage(founderId: string, message: string, routing: any) {
    const lower = message.toLowerCase();
    if (lower.includes('bookkeep') || lower.includes('invoice') || lower.includes('receipt')) return this.dispatch(founderId, 'finance.bookkeeper', message, routing);
    if (lower.includes('gst') || lower.includes('tax') || lower.includes('compliance') || lower.includes('gst_return')) return this.dispatch(founderId, 'finance.gst_compliance_agent', message, routing);
    if (lower.includes('cash') || lower.includes('revenue') || lower.includes('pnl') || lower.includes('burn')) return this.dispatch(founderId, 'finance.cashflow_forecaster', message, routing);
    return this.dispatch(founderId, 'finance.bookkeeper', message, routing);
  }
}
