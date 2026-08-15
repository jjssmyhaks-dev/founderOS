import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TraceService } from './trace.service';
import { EvalService } from './eval.service';
import { SpanEmitterService } from './span-emitter.service';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('observability')
export class ObservabilityController {
  constructor(
    private trace: TraceService,
    private evalService: EvalService,
    private spanEmitter: SpanEmitterService,
    private prisma: PrismaService,
  ) {}

  @Get('traces')
  async queryTraces(@Query('founderId') founderId?: string, @Query('agentId') agentId?: string, @Query('status') status?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('limit') limit?: string) {
    return this.trace.queryTraces({ founderId, agentId, status, from: from ? new Date(from) : undefined, to: to ? new Date(to) : undefined, limit: limit ? parseInt(limit) : undefined });
  }

  @Get('traces/:traceId')
  async getTrace(@Param('traceId') traceId: string) {
    return this.trace.getTrace(traceId);
  }

  @Get('metrics/agents')
  async agentMetrics(@Query('agentId') agentId: string, @Query('hours') hours?: string) {
    return this.trace.getAgentMetrics(agentId, hours ? parseInt(hours) : 24);
  }

  @Get('metrics/layers')
  async layerMetrics(@Query('hours') hours?: string) {
    return this.trace.getLayerMetrics(hours ? parseInt(hours) : 24);
  }

  @Get('metrics/connector-errors')
  async connectorErrorMetrics() {
    const since = new Date(Date.now() - 86400000);
    const failedSpans = await this.prisma.span.findMany({ where: { spanType: 'tool_call', status: 'failure', startedAt: { gte: since } }, select: { inputSummary: true, error: true, agentId: true, startedAt: true } });
    return failedSpans.map((s: any) => ({ toolName: s.inputSummary || 'unknown', error: s.error, agentId: s.agentId, at: s.startedAt }));
  }

  @Get('metrics/approval-latency')
  async approvalLatency() {
    const since = new Date(Date.now() - 7 * 86400000);
    const approvals = await this.prisma.approval.findMany({ where: { resolvedAt: { gte: since } }, select: { createdAt: true, resolvedAt: true, layer: true } });
    const byLayer: Record<string, number[]> = {};
    for (const a of approvals) {
      if (!a.resolvedAt) continue;
      const latency = new Date(a.resolvedAt).getTime() - new Date(a.createdAt).getTime();
      if (!byLayer[a.layer]) byLayer[a.layer] = [];
      byLayer[a.layer].push(latency);
    }
    return Object.entries(byLayer).map(([layer, latencies]) => {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p50 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)];
      return { layer, count: latencies.length, avgMs: Math.round(avg), p50Ms: Math.round(p50) };
    });
  }

  @Post('eval/:agentId')
  async runEval(@Param('agentId') agentId: string, @Body() body: any) {
    return this.evalService.runEval(agentId, body.testSetVersion || 'v1', body.triggeredBy || 'manual');
  }

  @Get('eval/history')
  async evalHistory(@Query('agentId') agentId?: string) {
    return this.evalService.getEvalHistory(agentId);
  }

  @Post('eval/:agentId/seed')
  async seedEval(@Param('agentId') agentId: string, @Body() body: any) {
    const count = await this.evalService.seedTestCases(agentId, body.cases || []);
    return { seeded: count };
  }

  @Get('leaderboard')
  async leaderboard() {
    const since = new Date(Date.now() - 7 * 86400000);
    const spans = await this.prisma.span.findMany({ where: { startedAt: { gte: since } } });
    const agents: Record<string, { total: number; success: number; failed: number; cost: number; avgSteps: number; escalations: number }> = {};
    for (const s of spans) {
      const id = s.agentId || 'unknown';
      if (!agents[id]) agents[id] = { total: 0, success: 0, failed: 0, cost: 0, avgSteps: 0, escalations: 0 };
      agents[id].total++;
      if (s.status === 'success') agents[id].success++;
      if (s.status === 'failure') agents[id].failed++;
      agents[id].cost += s.costEstimate || 0;
      if (s.spanType === 'approval_wait') agents[id].escalations++;
    }
    return Object.entries(agents).map(([agentId, m]) => ({ agentId, reliability: m.total > 0 ? Math.round((m.success / m.total) * 100) : 0, weeklyCost: Math.round(m.cost * 1000) / 1000, totalTasks: m.total, failures: m.failed, escalationRate: m.total > 0 ? Math.round((m.escalations / m.total) * 100) : 0 })).sort((a, b) => b.reliability - a.reliability);
  }
}
