import { Injectable, Logger } from '@nestjs/common';
import { AgentRuntimeService } from '../../agent-runtime/agent-runtime.service';
import { ActivityService } from '../../activity/activity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuid } from 'uuid';
import { AgentConfig, MODEL_TIERS } from '../../agent-runtime/types';

@Injectable()
export class ResearchLayerService {
  private readonly logger = new Logger(ResearchLayerService.name);

  constructor(
    private runtime: AgentRuntimeService,
    private activity: ActivityService,
    private prisma: PrismaService,
  ) {}

  // ── Sub-agent selection ────────────────────────────────────────────────

  private readonly SUB_AGENTS = [
    { id: 'competitor-intelligence', keywords: ['competitor', 'rival', 'competition', 'competing'] },
    { id: 'market-trend-scanning', keywords: ['market', 'trend', 'industry', 'sector', 'emerging'] },
    { id: 'pricing-benchmarking', keywords: ['pricing', 'price', 'cost', 'benchmark', 'unit economics'] },
    { id: 'customer-audience-research', keywords: ['customer', 'audience', 'persona', 'segment', 'demographic'] },
    { id: 'campaign-deep-dive', keywords: ['campaign', 'creative', 'roi', 'conversion', 'analytics'] },
  ];

  private selectAgent(message: string): string {
    // First: try keyword matching (fast)
    const lower = message.toLowerCase();
    for (const agent of this.SUB_AGENTS) {
      if (agent.keywords.some((kw) => lower.includes(kw))) return agent.id;
    }
    return 'market-trend-scanning'; // default for research
  }

  // ── Dispatch ──────────────────────────────────────────────────────────

  private async dispatch(founderId: string, agentId: string, goal: string, routing: any): Promise<any> {
    const taskId = uuid();
    const agentDef = this.getAgentConfig(agentId);

    await this.prisma.task.create({
      data: {
        id: taskId, agentId, founderId, layer: 'RESEARCH',
        title: goal.substring(0, 120), description: goal, goal,
        triggerType: 'orchestrator_assigned', status: 'PENDING',
        riskTier: 'NOTIFY_AND_ACT', maxSteps: agentDef.maxSteps,
      },
    });

    await this.activity.logActivity({ founderId, type: 'TASK_STARTED', description: 'Research: ' + goal.substring(0, 80) });

    this.runtime.executeTask({
      taskId, agentId, triggerType: 'orchestrator_assigned', goal,
      contextRefs: routing?.contextRefs || [], riskTierHint: null,
      deadline: null, parentTaskId: routing?.parentTaskId || null,
      founderId, layer: 'RESEARCH',
    }, agentDef).catch(e => this.activity.logActivity({ founderId, type: 'TASK_FAILED', description: 'Research task failed: ' + String(e) }));

    return {
      content: '**Research Layer** 📊\n\nTask dispatched to ' + agentId + '. Tracking ID: ' + taskId.substring(0, 8) + '...\n\nWorking on: ' + goal + '\n\nResults will appear in the Activity feed and can be inspected via the Task Trace viewer.',
      metadata: { taskId, subAgent: agentId },
    };
  }

  async handleMessage(founderId: string, message: string, routing: any) {
    // Use the LLM classification from the orchestrator if agentId was specified
    const agentId = routing.agentId || this.selectAgent(message);
    return this.dispatch(founderId, agentId, message, routing);
  }

  private getAgentConfig(agentId: string): AgentConfig {
    const isDeep = agentId === 'campaign-deep-dive' || agentId === 'competitor-intelligence';
    return {
      agentId, name: agentId, layer: 'RESEARCH',
      systemPrompt: 'You are a research analyst agent for a solo founder business. Analyze the given goal thoroughly and provide data-driven, actionable insights. Use tools to query context, search the web, and write important findings to memory.',
      model: isDeep ? MODEL_TIERS.RESEARCH_DEEP : MODEL_TIERS.DEFAULT,
      maxSteps: isDeep ? 12 : 8,
      contextTokenBudget: 10000,
      toolIds: [],
    };
  }
}
