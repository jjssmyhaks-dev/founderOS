import { Injectable, Logger } from '@nestjs/common';
import { AgentRuntimeService } from '../../agent-runtime/agent-runtime.service';
import { ActivityService } from '../../activity/activity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuid } from 'uuid';
import { AgentConfig, MODEL_TIERS } from '../../agent-runtime/types';

@Injectable()
export class MarketingLayerService {
  private readonly logger = new Logger(MarketingLayerService.name);

  constructor(
    private runtime: AgentRuntimeService,
    private activity: ActivityService,
    private prisma: PrismaService,
  ) {}

  private readonly SUB_AGENTS = [
    { id: 'digital-marketing-strategist', keywords: ['strategy', 'brand', 'voice', 'tone', 'positioning', 'plan'] },
    { id: 'performance-marketer', keywords: ['campaign', 'ad', 'performance', 'roas', 'cpc', 'ctr', 'spend'] },
    { id: 'content-copywriter', keywords: ['content', 'blog', 'copy', 'writing', 'email', 'landing page'] },
    { id: 'seo-specialist', keywords: ['seo', 'search', 'organic', 'ranking', 'keyword', 'backlink'] },
    { id: 'designer', keywords: ['design', 'creative', 'visual', 'graphic', 'logo', 'banner'] },
    { id: 'social-community', keywords: ['social', 'post', 'tweet', 'community', 'engagement', 'instagram'] },
  ];

  private selectAgent(message: string): string {
    const lower = message.toLowerCase();
    for (const agent of this.SUB_AGENTS) {
      if (agent.keywords.some((kw) => lower.includes(kw))) return agent.id;
    }
    return 'content-copywriter';
  }

  private async dispatch(founderId: string, agentId: string, goal: string, routing: any): Promise<any> {
    const taskId = uuid();
    const agentDef: AgentConfig = {
      agentId, name: agentId, layer: 'MARKETING',
      systemPrompt: 'You are a marketing specialist agent for a solo founder business. Create compelling, data-informed marketing content and strategies. Use tools to query context, analyze data, and write important insights to memory.',
      model: MODEL_TIERS.MARKETING, maxSteps: 10, contextTokenBudget: 8000, toolIds: [],
    };
    await this.prisma.task.create({
      data: {
        id: taskId, agentId, founderId, layer: 'MARKETING',
        title: goal.substring(0, 120), description: goal, goal,
        triggerType: 'orchestrator_assigned', status: 'PENDING',
        riskTier: 'NOTIFY_AND_ACT', maxSteps: 10,
      },
    });
    await this.activity.logActivity({ founderId, type: 'TASK_STARTED', description: 'Marketing: ' + goal.substring(0, 80) });
    this.runtime.executeTask({
      taskId, agentId, triggerType: 'orchestrator_assigned', goal,
      contextRefs: routing?.contextRefs || [], riskTierHint: null,
      deadline: null, parentTaskId: routing?.parentTaskId || null,
      founderId, layer: 'MARKETING',
    }, agentDef).catch(e => this.activity.logActivity({ founderId, type: 'TASK_FAILED', description: 'Marketing task failed: ' + String(e) }));
    return {
      content: '**Marketing Layer** 📬\n\nTask dispatched to ' + agentId + '. Tracking: ' + taskId.substring(0, 8) + '...\n\nWorking on: ' + goal,
      metadata: { taskId, subAgent: agentId },
    };
  }

  async handleMessage(founderId: string, message: string, routing: any) {
    const agentId = routing.agentId || this.selectAgent(message);
    return this.dispatch(founderId, agentId, message, routing);
  }
}
