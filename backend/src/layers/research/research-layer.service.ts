import { Injectable } from '@nestjs/common';
import { AgentRuntimeService } from '../../agent-runtime/agent-runtime.service';
import { ActivityService } from '../../activity/activity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuid } from 'uuid';
import { AgentConfig, MODEL_TIERS } from '../../agent-runtime/types';

@Injectable()
export class ResearchLayerService {
  constructor(
    private runtime: AgentRuntimeService,
    private activity: ActivityService,
    private prisma: PrismaService,
  ) {}

  private async dispatch(founderId: string, agentId: string, goal: string, routing: any): Promise<any> {
    const taskId = uuid();
    const agentDef = this.getAgentConfig(agentId, goal);

    await this.prisma.task.create({
      data: { id: taskId, agentId, founderId, layer: 'RESEARCH', description: goal, goal, triggerType: 'orchestrator_assigned', status: 'PENDING', riskTier: "NOTIFY_AND_ACT", maxSteps: agentDef.maxSteps } as any,
    });

    await this.activity.logActivity({ founderId, type: 'TASK_STARTED', description: 'Research: ' + goal.substring(0, 80) });

    this.runtime.executeTask({
      taskId, agentId, triggerType: 'orchestrator_assigned', goal,
      contextRefs: routing?.contextRefs || [], riskTierHint: null,
      deadline: null, parentTaskId: routing?.parentTaskId || null,
      founderId, layer: 'RESEARCH',
    }, agentDef).catch(e => this.activity.logActivity({ founderId, type: 'TASK_FAILED', description: 'Research task failed: ' + String(e) }));

    return { content: '**Research Layer** \ud83d\udcca\n\nTask dispatched to ' + agentId + '. Tracking ID: ' + taskId.substring(0, 8) + '...\n\nWorking on: ' + goal + '\n\nResults will appear in the Activity feed and can be inspected via the Task Trace viewer.', metadata: { taskId, subAgent: agentId } };
  }

  async handleMessage(founderId: string, message: string, routing: any) {
    const lower = message.toLowerCase();
    if (lower.includes('competitor') || lower.includes('rival')) return this.dispatch(founderId, 'research.competitor_intel', message, routing);
    if (lower.includes('market') || lower.includes('trend')) return this.dispatch(founderId, 'research.market_trend_scanning', message, routing);
    if (lower.includes('pricing') || lower.includes('price')) return this.dispatch(founderId, 'research.pricing_benchmarking', message, routing);
    if (lower.includes('customer') || lower.includes('audience')) return this.dispatch(founderId, 'research.customer_audience_research', message, routing);
    return this.dispatch(founderId, 'research.campaign_deep_dive', message, routing);
  }

  private getAgentConfig(agentId: string, goal: string): AgentConfig {
    const isDeep = agentId.includes('deep_dive') || agentId.includes('competitor');
    return {
      agentId, name: agentId, layer: 'RESEARCH',
      systemPrompt: 'You are a research analyst agent. Analyze the given goal thoroughly and provide data-driven insights.',
      model: isDeep ? MODEL_TIERS.RESEARCH_DEEP : MODEL_TIERS.DEFAULT,
      maxSteps: isDeep ? 12 : 8, contextTokenBudget: 10000, toolIds: [],
    };
  }
}

