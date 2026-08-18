import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { AgentRuntimeService } from './agent-runtime.service';
import { AGENT_REGISTRY } from '../agents/agents.service';
import { AgentConfig, MODEL_TIERS } from './types';

interface HandoffSubscription {
  eventType: string;
  agentId: string;
  layer: string;
}

@Injectable()
export class HandoffService implements OnModuleInit {
  private readonly logger = new Logger(HandoffService.name);
  private subscriptions: HandoffSubscription[] = [];

  constructor(
    private prisma: PrismaService,
    private events: EventService,
    private runtime: AgentRuntimeService,
  ) {}

  onModuleInit() {
    this.buildSubscriptions();
    for (const sub of this.subscriptions) {
      this.events.subscribe(sub.agentId, [sub.eventType]);
    }
    this.logger.log('Registered ' + this.subscriptions.length + ' handoff subscriptions');
  }

  private buildSubscriptions() {
    // Cross-layer handoff: events published by one layer can trigger agents in another
    const crossLayerRules: Array<{ event: string; targetAgents: string[] }> = [
      { event: 'task.completed', targetAgents: [] }, // handled by orchestrators, not direct
      { event: 'research.competitor_update', targetAgents: ['content-copywriter', 'social-community'] },
      { event: 'marketing.campaign_launched', targetAgents: ['scheduling-capacity'] },
      { event: 'finance.cashflow_alert', targetAgents: ['scheduling-capacity'] },
      { event: 'approval.requested', targetAgents: [] }, // handled by approval queue UI
    ];

    for (const rule of crossLayerRules) {
      for (const agentId of rule.targetAgents) {
        const agentDef = AGENT_REGISTRY.find((a: any) => a.id === agentId);
        if (agentDef) {
          this.subscriptions.push({
            eventType: rule.event,
            agentId,
            layer: agentDef.layer,
          });
        }
      }
    }
  }

  private async handleHandoff(sub: HandoffSubscription, payload: any) {
    if (!payload?.taskId) return;

    const agentDef = AGENT_REGISTRY.find((a: any) => a.id === sub.agentId);
    if (!agentDef) return;

    const config: AgentConfig = {
      agentId: sub.agentId,
      name: agentDef.name,
      layer: sub.layer,
      systemPrompt: '',
      model: MODEL_TIERS.DEFAULT,
      maxSteps: 8,
      contextTokenBudget: 8000,
      toolIds: [],
    };

    try {
      await this.runtime.executeTask({
        taskId: payload.taskId + ':handoff:' + sub.agentId,
        agentId: sub.agentId,
        triggerType: 'event_triggered',
        goal: 'Process event: ' + sub.eventType + ' from related task. Context: ' + JSON.stringify(payload),
        contextRefs: payload.contextRefs || [],
        riskTierHint: null,
        deadline: null,
        parentTaskId: payload.taskId,
        founderId: payload.founderId || '',
        layer: sub.layer,
      }, config);
    } catch (e) {
      this.logger.error('Handoff failed for ' + sub.agentId + ': ' + String(e));
    }
  }
}

