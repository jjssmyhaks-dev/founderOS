import { Injectable } from '@nestjs/common';
import { AgentRuntimeService } from '../../agent-runtime/agent-runtime.service';
import { ActivityService } from '../../activity/activity.service';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuid } from 'uuid';
import { AgentConfig, MODEL_TIERS } from '../../agent-runtime/types';

@Injectable()
export class OperationsLayerService {
  constructor(
    private runtime: AgentRuntimeService,
    private activity: ActivityService,
    private prisma: PrismaService,
  ) {}

  private async dispatch(founderId: string, agentId: string, goal: string, routing: any): Promise<any> {
    const taskId = uuid();
    const agentDef: AgentConfig = {
      agentId, name: agentId, layer: 'OPERATIONS',
      systemPrompt: 'You are an operations agent. Handle scheduling, notifications, and process automation efficiently.',
      model: MODEL_TIERS.OPERATIONS, maxSteps: 6, contextTokenBudget: 6000, toolIds: [],
    };
    await this.prisma.task.create({
      data: { id: taskId, agentId, founderId, layer: 'OPERATIONS', description: goal, goal, triggerType: 'orchestrator_assigned', status: 'PENDING', riskTier: 'NOTIFY_AND_ACT', maxSteps: 6 } as any,
    });
    await this.activity.logActivity({ founderId, type: 'TASK_STARTED', description: 'Operations: ' + goal.substring(0, 80) });
    this.runtime.executeTask({ taskId, agentId, triggerType: 'orchestrator_assigned', goal, contextRefs: routing?.contextRefs || [], riskTierHint: null, deadline: null, parentTaskId: routing?.parentTaskId || null, founderId, layer: 'OPERATIONS' }, agentDef).catch(e => this.activity.logActivity({ founderId, type: 'TASK_FAILED', description: 'Ops task failed: ' + String(e) }));
    return { content: '**Operations Layer** \u2699\ufe0f\n\nTask dispatched to ' + agentId + '. Tracking: ' + taskId.substring(0, 8) + '...\n\nWorking on: ' + goal, metadata: { taskId, subAgent: agentId } };
  }

  async handleMessage(founderId: string, message: string, routing: any) {
    const lower = message.toLowerCase();
    if (lower.includes('schedule') || lower.includes('calendar') || lower.includes('meeting')) return this.dispatch(founderId, 'operations.scheduling_coordinator', message, routing);
    if (lower.includes('notif') || lower.includes('alert') || lower.includes('remind')) return this.dispatch(founderId, 'operations.notification_manager', message, routing);
    if (lower.includes('process') || lower.includes('workflow') || lower.includes('automate')) return this.dispatch(founderId, 'operations.process_automator', message, routing);
    return this.dispatch(founderId, 'operations.scheduling_coordinator', message, routing);
  }
}
