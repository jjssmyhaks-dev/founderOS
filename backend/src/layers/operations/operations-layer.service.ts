import { Injectable, Logger } from '@nestjs/common';
import { AgentRuntimeService } from '../../agent-runtime/agent-runtime.service';
import { ActivityService } from '../../activity/activity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuid } from 'uuid';
import { AgentConfig, MODEL_TIERS } from '../../agent-runtime/types';

@Injectable()
export class OperationsLayerService {
  private readonly logger = new Logger(OperationsLayerService.name);

  constructor(
    private runtime: AgentRuntimeService,
    private activity: ActivityService,
    private prisma: PrismaService,
  ) {}

  private readonly SUB_AGENTS = [
    { id: 'process-workflow', keywords: ['process', 'workflow', 'automate', 'bottleneck', 'efficiency'] },
    { id: 'vendor-supply-chain', keywords: ['vendor', 'supply', 'procurement', 'supplier', 'order'] },
    { id: 'quality-fulfillment', keywords: ['quality', 'fulfillment', 'defect', 'return', 'shipping'] },
    { id: 'customer-support', keywords: ['support', 'ticket', 'customer service', 'complaint', 'help'] },
    { id: 'scheduling-capacity', keywords: ['schedule', 'calendar', 'meeting', 'capacity', 'availability'] },
  ];

  private selectAgent(message: string): string {
    const lower = message.toLowerCase();
    for (const agent of this.SUB_AGENTS) {
      if (agent.keywords.some((kw) => lower.includes(kw))) return agent.id;
    }
    return 'process-workflow';
  }

  private async dispatch(founderId: string, agentId: string, goal: string, routing: any): Promise<any> {
    const taskId = uuid();
    const agentDef: AgentConfig = {
      agentId, name: agentId, layer: 'OPERATIONS',
      systemPrompt: 'You are an operations agent for a solo founder business. Handle scheduling, notifications, process automation, and vendor management efficiently. Use tools to query context, check task status, and write findings to memory.',
      model: MODEL_TIERS.OPERATIONS, maxSteps: 8, contextTokenBudget: 6000, toolIds: [],
    };
    await this.prisma.task.create({
      data: {
        id: taskId, agentId, founderId, layer: 'OPERATIONS',
        title: goal.substring(0, 120), description: goal, goal,
        triggerType: 'orchestrator_assigned', status: 'PENDING',
        riskTier: 'NOTIFY_AND_ACT', maxSteps: 8,
      },
    });
    await this.activity.logActivity({ founderId, type: 'TASK_STARTED', description: 'Operations: ' + goal.substring(0, 80) });
    this.runtime.executeTask({
      taskId, agentId, triggerType: 'orchestrator_assigned', goal,
      contextRefs: routing?.contextRefs || [], riskTierHint: null,
      deadline: null, parentTaskId: routing?.parentTaskId || null,
      founderId, layer: 'OPERATIONS',
    }, agentDef).catch(e => this.activity.logActivity({ founderId, type: 'TASK_FAILED', description: 'Ops task failed: ' + String(e) }));
    return {
      content: '**Operations Layer** ⚙️\n\nTask dispatched to ' + agentId + '. Tracking: ' + taskId.substring(0, 8) + '...\n\nWorking on: ' + goal,
      metadata: { taskId, subAgent: agentId },
    };
  }

  async handleMessage(founderId: string, message: string, routing: any) {
    const agentId = routing.agentId || this.selectAgent(message);
    return this.dispatch(founderId, agentId, message, routing);
  }
}
