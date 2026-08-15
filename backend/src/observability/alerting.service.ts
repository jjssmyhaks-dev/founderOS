import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { ActivityService } from '../activity/activity.service';

interface AlertRule {
  eventType: string;
  severity: 'high' | 'medium' | 'low';
  checkFn: string;
  thresholdMinutes: number;
}

@Injectable()
export class AlertingService implements OnModuleInit {
  private readonly logger = new Logger(AlertingService.name);
  private alertHistory = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private events: EventService,
    private activity: ActivityService,
  ) {}

  onModuleInit() {
    this.events.subscribe('system', ['connector.unhealthy', 'agent.stuck', 'approval.pending_too_long', 'budget.threshold_hit', 'span.failed']);
    this.logger.log('Alerting service initialized');
  }

  async evaluateEvent(eventType: string, payload: any): Promise<void> {
    const rules: AlertRule[] = [
      { eventType: 'connector.unhealthy', severity: 'high', checkFn: 'always', thresholdMinutes: 0 },
      { eventType: 'agent.stuck', severity: 'medium', checkFn: 'always', thresholdMinutes: 0 },
      { eventType: 'approval.pending_too_long', severity: 'low', checkFn: 'always', thresholdMinutes: 0 },
      { eventType: 'budget.threshold_hit', severity: 'medium', checkFn: 'always', thresholdMinutes: 0 },
    ];

    for (const rule of rules) {
      if (eventType === rule.eventType) {
        const cooldown = rule.thresholdMinutes * 60000;
        const key = rule.eventType + ':' + (payload.agentId || payload.connector || 'global');
        const lastAlert = this.alertHistory.get(key) || 0;
        if (Date.now() - lastAlert < cooldown) continue;
        this.alertHistory.set(key, Date.now());
        await this.fireAlert(rule, payload);
      }
    }

    if (eventType === 'span.failed') {
      await this.checkAgentFailureRate(payload);
    }
  }

  private async fireAlert(rule: AlertRule, payload: any): Promise<void> {
    const msg = '[ALERT ' + rule.severity.toUpperCase() + '] ' + rule.eventType + ': ' + JSON.stringify(payload).substring(0, 200);
    this.logger.warn(msg);
    await this.activity.logActivity({ founderId: payload.founderId || '', type: 'ALERT_' + rule.severity.toUpperCase(), description: msg });
    await this.events.publish({ type: 'system.alert.fired', publisher: 'alerting', payload: { rule: rule.eventType, severity: rule.severity, payload } as any });
  }

  private async checkAgentFailureRate(payload: any): Promise<void> {
    if (!payload.agentId) return;
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recent = await this.prisma.span.count({ where: { agentId: payload.agentId, status: 'failure', startedAt: { gte: oneHourAgo } } });
    const total = await this.prisma.span.count({ where: { agentId: payload.agentId, startedAt: { gte: oneHourAgo } } });
    if (total > 5 && (recent / total) > 0.2) {
      const msg = 'Agent ' + payload.agentId + ' failure rate ' + Math.round((recent / total) * 100) + '% in last hour';
      this.logger.warn(msg);
      await this.activity.logActivity({ founderId: '', type: 'ALERT_HIGH', description: msg });
    }
  }
}
