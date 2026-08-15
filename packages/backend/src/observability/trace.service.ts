import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TraceService {
  private readonly logger = new Logger(TraceService.name);

  constructor(private prisma: PrismaService, private events: EventService) {}

  async createTrace(founderId: string, originType: 'founder_message' | 'scheduled_trigger' | 'event_triggered', originRef?: string): Promise<string> {
    const traceId = uuidv4();
    await this.prisma.trace.create({ data: { id: traceId, originType, originRef: originRef || null, founderId, status: 'in_progress' } });
    return traceId;
  }

  async completeTrace(traceId: string, status: 'completed' | 'failed' | 'awaiting_approval'): Promise<void> {
    await this.prisma.trace.update({ where: { id: traceId }, data: { endedAt: new Date(), status } });
    this.events.publish({ type: 'system.trace.completed', publisher: 'system', payload: { traceId, status } as any, correlationId: traceId });
  }

  async getTrace(traceId: string) {
    const trace = await this.prisma.trace.findUnique({ where: { id: traceId } });
    if (!trace) return null;
    const spans = await this.prisma.span.findMany({ where: { traceId }, orderBy: { startedAt: 'asc' } });
    return { ...trace, spans };
  }

  async queryTraces(filters: { founderId?: string; agentId?: string; status?: string; originType?: string; from?: Date; to?: Date; limit?: number }) {
    const where: any = {};
    if (filters.founderId) where.founderId = filters.founderId;
    if (filters.status) where.status = filters.status;
    if (filters.originType) where.originType = filters.originType;
    if (filters.from || filters.to) {
      where.startedAt = {};
      if (filters.from) where.startedAt.gte = filters.from;
      if (filters.to) where.startedAt.lte = filters.to;
    }
    if (filters.agentId) {
      where.spans = { some: { agentId: filters.agentId } };
    }
    return this.prisma.trace.findMany({ where, orderBy: { startedAt: 'desc' }, take: filters.limit || 50 });
  }

  async getAgentMetrics(agentId: string, hours: number = 24) {
    const since = new Date(Date.now() - hours * 3600000);
    const spans = await this.prisma.span.findMany({ where: { agentId, startedAt: { gte: since } } });
    const total = spans.length;
    const completed = spans.filter(s => s.status === 'success').length;
    const failed = spans.filter(s => s.status === 'failure').length;
    const avgDuration = spans.filter(s => s.startedAt && s.endedAt).reduce((sum, s) => sum + (new Date(s.endedAt!).getTime() - new Date(s.startedAt!).getTime()), 0) / Math.max(total, 1);
    const totalTokens = spans.reduce((sum, s) => sum + (s.tokensUsed || 0), 0);
    const totalCost = spans.reduce((sum, s) => sum + (s.costEstimate || 0), 0);
    return { agentId, period: hours + 'h', totalSpans: total, successRate: total > 0 ? Math.round((completed / total) * 100) : 0, failed, avgDurationMs: Math.round(avgDuration), totalTokens, totalCost: Math.round(totalCost * 1000) / 1000 };
  }

  async getLayerMetrics(hours: number = 24) {
    const since = new Date(Date.now() - hours * 3600000);
    const spans = await this.prisma.span.findMany({ where: { startedAt: { gte: since } } });
    const layers: Record<string, { total: number; success: number; failed: number; cost: number; tokens: number }> = {};
    for (const s of spans) {
      const agent = s.agentId || 'unknown';
      const layer = agent.includes('research') ? 'RESEARCH' : agent.includes('marketing') ? 'MARKETING' : agent.includes('finance') ? 'FINANCE' : agent.includes('operation') ? 'OPERATIONS' : 'OTHER';
      if (!layers[layer]) layers[layer] = { total: 0, success: 0, failed: 0, cost: 0, tokens: 0 };
      layers[layer].total++;
      if (s.status === 'success') layers[layer].success++;
      if (s.status === 'failure') layers[layer].failed++;
      layers[layer].cost += s.costEstimate || 0;
      layers[layer].tokens += s.tokensUsed || 0;
    }
    return Object.entries(layers).map(([layer, m]) => ({ layer, ...m, successRate: m.total > 0 ? Math.round((m.success / m.total) * 100) : 0 }));
  }
}
