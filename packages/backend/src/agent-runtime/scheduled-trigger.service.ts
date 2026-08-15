import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRuntimeService } from './agent-runtime.service';
import { AgentConfig, MODEL_TIERS } from './types';
import { v4 as uuidv4 } from 'uuid';

interface ScheduledTrigger {
  agentId: string;
  cronExpr: string;
  goal: string;
  layer: string;
  founderId: string;
  systemPrompt: string;
  modelTier?: string;
  maxSteps?: number;
}

@Injectable()
export class ScheduledTriggerService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledTriggerService.name);
  private triggers = new Map<string, ScheduledTrigger>();

  constructor(
    private prisma: PrismaService,
    private runtime: AgentRuntimeService,
  ) {}

  onModuleInit() {
    this.registerDefaultTriggers();
    this.logger.log('Scheduled triggers: ' + this.triggers.size + ' defaults');
  }

  private registerDefaultTriggers() {
    this.triggers.set('research.daily_competitor_scan', {
      agentId: 'research.competitor_intel', cronExpr: '0 9 * * 1-5',
      goal: 'Run daily competitive landscape scan. Check for new competitor products, pricing changes, and market moves.',
      layer: 'RESEARCH', founderId: 'system',
      systemPrompt: 'You are a competitive intelligence agent.', modelTier: 'RESEARCH_DEEP', maxSteps: 12,
    });
    this.triggers.set('marketing.weekly_content_review', {
      agentId: 'marketing.performance_marketer', cronExpr: '0 10 * * 0',
      goal: 'Review weekly content and campaign performance. Identify top performers and underperformers.',
      layer: 'MARKETING', founderId: 'system',
      systemPrompt: 'You are a performance marketing analyst.', modelTier: 'MARKETING', maxSteps: 8,
    });
    this.triggers.set('finance.daily_cashflow', {
      agentId: 'finance.bookkeeper', cronExpr: '0 8 * * 1-6',
      goal: 'Review daily cash flow status. Flag concerning trends or overdue receivables.',
      layer: 'FINANCE', founderId: 'system',
      systemPrompt: 'You are a financial bookkeeping agent.', modelTier: 'FINANCE', maxSteps: 6,
    });
  }

  async runTrigger(triggerId: string): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) { this.logger.warn('Unknown trigger: ' + triggerId); return; }
    const taskId = uuidv4();
    this.logger.log('Firing trigger: ' + triggerId);
    await this.prisma.task.create({
      data: { id: taskId, agentId: trigger.agentId, founderId: trigger.founderId, layer: trigger.layer, description: 'Scheduled: ' + trigger.goal, goal: trigger.goal, triggerType: 'scheduled', status: 'PENDING', riskTier: 'NOTIFY_AND_ACT', maxSteps: trigger.maxSteps || 8 } as any,
    });
    const config: AgentConfig = {
      agentId: trigger.agentId, name: triggerId, layer: trigger.layer,
      systemPrompt: trigger.systemPrompt,
      model: trigger.modelTier ? MODEL_TIERS[trigger.modelTier] : MODEL_TIERS.DEFAULT,
      maxSteps: trigger.maxSteps || 8, contextTokenBudget: 8000, toolIds: [],
    };
    try {
      await this.runtime.executeTask({ taskId, agentId: trigger.agentId, triggerType: 'scheduled', goal: trigger.goal, contextRefs: [], riskTierHint: null, deadline: null, parentTaskId: null, founderId: trigger.founderId, layer: trigger.layer }, config);
    } catch (e) { this.logger.error('Trigger ' + triggerId + ' failed: ' + String(e)); }
  }

  getTriggers(): Array<{ id: string; agentId: string; cronExpr: string; goal: string }> {
    return Array.from(this.triggers.entries()).map(([id, t]) => ({ id, agentId: t.agentId, cronExpr: t.cronExpr, goal: t.goal }));
  }
}
