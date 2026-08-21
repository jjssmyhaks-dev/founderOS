import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { AgentRuntimeService } from './agent-runtime.service';
import { AGENT_REGISTRY } from '../agents/agents.service';
import { AgentConfig, MODEL_TIERS } from './types';
import { v4 } from 'uuid';
import Redis from 'ioredis';

interface HandoffSubscription {
  eventType: string;
  agentId: string;
  layer: string;
}

@Injectable()
export class HandoffService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HandoffService.name);
  private subscriptions: HandoffSubscription[] = [];
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private events: EventService,
    private runtime: AgentRuntimeService,
    private config: ConfigService,
  ) {
    const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
  }

  async onModuleInit() {
    this.buildSubscriptions();
    // Subscribe to all events on Redis
    this.redis.subscribe('helm:events:all', (err) => {
      if (err) this.logger.error('Redis subscribe failed: ' + err.message);
      else this.logger.log('HandoffService subscribed to helm:events:all');
    });
    this.redis.on('message', (channel, message) => {
      this.handleRedisMessage(channel, message).catch((e) =>
        this.logger.error('Handoff handler error: ' + String(e)),
      );
    });
    this.logger.log('HandoffService initialized with ' + this.subscriptions.length + ' cross-layer rules');
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  private buildSubscriptions() {
    // Cross-layer handoff rules: when these events fire, trigger the target agents
    const crossLayerRules: Array<{ event: string; targetAgents: string[] }> = [
      // Research → Marketing: competitor findings trigger content/social updates
      { event: 'competitor.detected', targetAgents: ['content-copywriter', 'social-community', 'digital-marketing-strategist'] },
      { event: 'market.trend_shift', targetAgents: ['digital-marketing-strategist', 'seo-specialist'] },
      { event: 'pricing.benchmark_changed', targetAgents: ['pricing-unit-economics', 'pricing-benchmarking'] },
      { event: 'audience.segment_shift', targetAgents: ['content-copywriter', 'social-community'] },

      // Marketing → Operations: campaign events trigger scheduling/support
      { event: 'campaign.budget_exhausted', targetAgents: ['digital-marketing-strategist', 'scheduling-capacity'] },
      { event: 'lead_source.underperforming', targetAgents: ['digital-marketing-strategist'] },

      // Operations → Finance: delivery/quality issues affect finances
      { event: 'delivery.delayed', targetAgents: ['cashflow-forecasting', 'customer-support'] },
      { event: 'quality.issue_detected', targetAgents: ['customer-support', 'cashflow-forecasting'] },
      { event: 'capacity.constrained', targetAgents: ['scheduling-capacity'] },

      // Finance → All: cash flow alerts affect everything
      { event: 'cashflow.risk', targetAgents: ['scheduling-capacity', 'digital-marketing-strategist'] },
      { event: 'expense.spike', targetAgents: ['bookkeeping', 'cashflow-forecasting'] },
      { event: 'revenue.milestone_hit', targetAgents: ['fundraising-investor-relations', 'digital-marketing-strategist'] },
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

  private async handleRedisMessage(_channel: string, message: string) {
    let event: any;
    try {
      event = JSON.parse(message);
    } catch {
      return;
    }

    // Skip events we published ourselves (prevent loops)
    if (event.publisher === 'handoff') return;
    // Skip system events and task lifecycle events (already handled)
    if (event.type === 'task.completed' || event.type === 'task.failed' || event.type === 'task.created') return;

    const matchingSubs = this.subscriptions.filter((s) => s.eventType === event.type);
    if (matchingSubs.length === 0) return;

    const founderId = event.founderId || event.payload?.founderId;
    if (!founderId) return;

    this.logger.log('Event ' + event.type + ' triggers ' + matchingSubs.length + ' agents');

    for (const sub of matchingSubs) {
      // Don't trigger the agent that published the event
      if (sub.agentId === event.publisher) continue;

      // Check if this agent is already working on something related
      const recentTask = await this.prisma.task.findFirst({
        where: {
          agentId: sub.agentId,
          founderId,
          status: { in: ['RUNNING', 'PENDING', 'AWAITING_APPROVAL'] },
          createdAt: { gte: new Date(Date.now() - 3600000) }, // last hour
        },
      });
      if (recentTask) {
        this.logger.verbose('Skipping ' + sub.agentId + ' — already active on task ' + recentTask.id);
        continue;
      }

      // Create and execute the triggered task
      const taskId = v4();
      const agentDef = AGENT_REGISTRY.find((a: any) => a.id === sub.agentId);
      const goal = this.buildTriggerGoal(sub, event, agentDef);

      await this.prisma.task.create({
        data: {
          id: taskId, agentId: sub.agentId, founderId, layer: sub.layer,
          title: 'Event-triggered: ' + event.type, description: goal, goal,
          triggerType: 'event_triggered', status: 'PENDING',
          riskTier: 'NOTIFY_AND_ACT', maxSteps: 8,
        },
      });

      const config: AgentConfig = {
        agentId: sub.agentId, name: agentDef?.name || sub.agentId, layer: sub.layer,
        systemPrompt: agentDef?.responsibility || '',
        model: MODEL_TIERS.DEFAULT, maxSteps: 8, contextTokenBudget: 8000, toolIds: [],
      };

      this.runtime.executeTask({
        taskId, agentId: sub.agentId, triggerType: 'event_triggered',
        goal, contextRefs: [], riskTierHint: null, deadline: null,
        parentTaskId: event.payload?.taskId || null,
        founderId, layer: sub.layer, traceId: event.correlationId,
      }, config).catch((e) =>
        this.logger.error('Handoff task failed for ' + sub.agentId + ': ' + String(e)),
      );
    }
  }

  private buildTriggerGoal(sub: HandoffSubscription, event: any, agentDef: any): string {
    const responsibility = agentDef?.responsibility || 'process the event';
    const eventPayload = event.payload ? JSON.stringify(event.payload).substring(0, 500) : '';
    return `An event occurred that requires your attention as ${responsibility}.\n\nEvent: ${event.type}\nPublished by: ${event.publisher}\nPayload: ${eventPayload}\n\nAnalyze this event and take appropriate action within your domain.`;
  }
}
