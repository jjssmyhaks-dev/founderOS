import { Injectable } from '@nestjs/common';
import { AgentRuntimeService } from '../../agent-runtime/agent-runtime.service';
import { ActivityService } from '../../activity/activity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuid } from 'uuid';
import { AgentConfig, MODEL_TIERS } from '../../agent-runtime/types';

@Injectable()
export class MarketingLayerService {
  constructor(
    private runtime: AgentRuntimeService,
    private activity: ActivityService,
    private prisma: PrismaService,
  ) {}

  private async dispatch(founderId: string, agentId: string, goal: string, routing: any): Promise<any> {
    const taskId = uuid();
    const agentDef: AgentConfig = {
      agentId, name: agentId, layer: 'MARKETING',
      systemPrompt: 'You are a marketing specialist agent. Create compelling, data-informed marketing content and strategies.',
      model: MODEL_TIERS.MARKETING, maxSteps: 8, contextTokenBudget: 8000, toolIds: [],
    };
    await this.prisma.task.create({
      data: { id: taskId, agentId, founderId, layer: 'MARKETING', description: goal, goal, triggerType: 'orchestrator_assigned', status: 'PENDING', riskTier: 'NOTIFY_AND_ACT', maxSteps: 8 } as any,
    });
    await this.activity.logActivity({ founderId, type: 'TASK_STARTED', description: 'Marketing: ' + goal.substring(0, 80) });
    this.runtime.executeTask({ taskId, agentId, triggerType: 'orchestrator_assigned', goal, contextRefs: routing?.contextRefs || [], riskTierHint: null, deadline: null, parentTaskId: routing?.parentTaskId || null, founderId, layer: 'MARKETING' }, agentDef).catch(e => this.activity.logActivity({ founderId, type: 'TASK_FAILED', description: 'Marketing task failed: ' + String(e) }));
    return { content: '**Marketing Layer** \ud83d\udcbc\n\nTask dispatched to ' + agentId + '. Tracking: ' + taskId.substring(0, 8) + '...\n\nWorking on: ' + goal, metadata: { taskId, subAgent: agentId } };
  }

  async handleMessage(founderId: string, message: string, routing: any) {
    const lower = message.toLowerCase();
    if (lower.includes('content') || lower.includes('blog') || lower.includes('copy')) return this.dispatch(founderId, 'marketing.content_copywriter', message, routing);
    if (lower.includes('social') || lower.includes('post') || lower.includes('tweet')) return this.dispatch(founderId, 'marketing.social_media_manager', message, routing);
    if (lower.includes('campaign') || lower.includes('ad') || lower.includes('performance')) return this.dispatch(founderId, 'marketing.performance_marketer', message, routing);
    if (lower.includes('brand') || lower.includes('voice') || lower.includes('tone')) return this.dispatch(founderId, 'marketing.brand_voice', message, routing);
    return this.dispatch(founderId, 'marketing.content_copywriter', message, routing);
  }
}
