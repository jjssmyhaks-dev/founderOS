import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';

export interface AgentDefinition {
  id: string;
  name: string;
  layer: string;
  role: string;
  responsibility: string;
  status: string;
  emits: string[];
  listensFor: string[];
}

export const AGENT_REGISTRY: AgentDefinition[] = [
  // ===== RESEARCH LAYER (5) =====
  {
    id: 'competitor-intelligence',
    name: 'Competitor Intelligence',
    layer: 'RESEARCH',
    role: 'SUB_AGENT',
    responsibility: 'Monitors competitor activities, pricing changes, product launches, and market positioning.',
    status: 'IDLE',
    emits: ['competitor.detected', 'pricing.benchmark_changed'],
    listensFor: ['competitor.detected', 'market.trend_shift'],
  },
  {
    id: 'market-trend-scanning',
    name: 'Market Trend Scanning',
    layer: 'RESEARCH',
    role: 'SUB_AGENT',
    responsibility: 'Scans industry trends, emerging technologies, regulatory changes, and market shifts.',
    status: 'IDLE',
    emits: ['market.trend_shift'],
    listensFor: ['market.trend_shift'],
  },
  {
    id: 'pricing-benchmarking',
    name: 'Pricing Benchmarking',
    layer: 'RESEARCH',
    role: 'SUB_AGENT',
    responsibility: 'Tracks competitor pricing, identifies pricing opportunities, and benchmarks unit economics.',
    status: 'IDLE',
    emits: ['pricing.benchmark_changed'],
    listensFor: ['pricing.benchmark_changed', 'competitor.detected'],
  },
  {
    id: 'customer-audience-research',
    name: 'Customer & Audience Research',
    layer: 'RESEARCH',
    role: 'SUB_AGENT',
    responsibility: 'Researches target audiences, customer segments, personas, and behavioral patterns.',
    status: 'IDLE',
    emits: ['audience.segment_shift'],
    listensFor: ['market.trend_shift', 'customer_audience.update'],
  },
  {
    id: 'campaign-deep-dive',
    name: 'Campaign Deep Dive',
    layer: 'RESEARCH',
    role: 'SUB_AGENT',
    responsibility: 'Analyzes past campaigns, creative effectiveness, copy performance, and ROI insights.',
    status: 'IDLE',
    emits: ['campaign.budget_exhausted'],
    listensFor: ['lead_source.underperforming', 'campaign.budget_exhausted'],
  },
  // ===== MARKETING LAYER (6) =====
  {
    id: 'digital-marketing-strategist',
    name: 'Digital Marketing Strategist',
    layer: 'MARKETING',
    role: 'SUB_AGENT',
    responsibility: 'Designs multi-channel digital marketing strategies, budget allocation, and channel mix.',
    status: 'IDLE',
    emits: ['lead_source.underperforming'],
    listensFor: ['market.trend_shift', 'audience.segment_shift'],
  },
  {
    id: 'performance-marketer',
    name: 'Performance Marketer',
    layer: 'MARKETING',
    role: 'SUB_AGENT',
    responsibility: 'Manages paid campaigns across Meta, Google, and other platforms with optimization.',
    status: 'IDLE',
    emits: ['campaign.budget_exhausted'],
    listensFor: ['lead_source.underperforming', 'campaign.budget_exhausted'],
  },
  {
    id: 'content-copywriter',
    name: 'Content & Copywriter',
    layer: 'MARKETING',
    role: 'SUB_AGENT',
    responsibility: 'Creates marketing copy, blog posts, email campaigns, and ad creative.',
    status: 'IDLE',
    emits: ['lead_source.underperforming'],
    listensFor: ['market.trend_shift', 'campaign.budget_exhausted'],
  },
  {
    id: 'seo-specialist',
    name: 'SEO Specialist',
    layer: 'MARKETING',
    role: 'SUB_AGENT',
    responsibility: 'Optimizes search engine rankings, keywords, technical SEO, and content for organic growth.',
    status: 'IDLE',
    emits: ['lead_source.underperforming'],
    listensFor: ['market.trend_shift'],
  },
  {
    id: 'designer',
    name: 'Designer',
    layer: 'MARKETING',
    role: 'SUB_AGENT',
    responsibility: 'Creates visual assets, ad creatives, social media graphics, and brand materials.',
    status: 'IDLE',
    emits: ['lead_source.underperforming'],
    listensFor: ['campaign.budget_exhausted', 'audience.segment_shift'],
  },
  {
    id: 'social-community',
    name: 'Social & Community',
    layer: 'MARKETING',
    role: 'SUB_AGENT',
    responsibility: 'Manages social media presence, community engagement, and brand voice.',
    status: 'IDLE',
    emits: ['audience.segment_shift'],
    listensFor: ['audience.segment_shift', 'market.trend_shift'],
  },
  // ===== OPERATIONS LAYER (5) =====
  {
    id: 'process-workflow',
    name: 'Process & Workflow',
    layer: 'OPERATIONS',
    role: 'SUB_AGENT',
    responsibility: 'Optimizes business processes, automates workflows, and identifies bottlenecks.',
    status: 'IDLE',
    emits: ['operations.feature_shipped'],
    listensFor: ['delivery.delayed', 'capacity.constrained'],
  },
  {
    id: 'vendor-supply-chain',
    name: 'Vendor & Supply Chain',
    layer: 'OPERATIONS',
    role: 'SUB_AGENT',
    responsibility: 'Manages vendor relationships, supply chain logistics, and procurement.',
    status: 'IDLE',
    emits: ['delivery.delayed'],
    listensFor: ['delivery.delayed', 'capacity.constrained'],
  },
  {
    id: 'quality-fulfillment',
    name: 'Quality & Fulfillment',
    layer: 'OPERATIONS',
    role: 'SUB_AGENT',
    responsibility: 'Ensures quality control, fulfillment accuracy, and customer satisfaction.',
    status: 'IDLE',
    emits: ['quality.issue_detected'],
    listensFor: ['quality.issue_detected', 'delivery.delayed'],
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    layer: 'OPERATIONS',
    role: 'SUB_AGENT',
    responsibility: 'Handles customer inquiries, tickets, support escalations, and satisfaction metrics.',
    status: 'IDLE',
    emits: ['operations.feature_shipped'],
    listensFor: ['quality.issue_detected', 'delivery.delayed'],
  },
  {
    id: 'scheduling-capacity',
    name: 'Scheduling & Capacity',
    layer: 'OPERATIONS',
    role: 'SUB_AGENT',
    responsibility: 'Manages scheduling, capacity planning, resource allocation, and time management.',
    status: 'IDLE',
    emits: ['capacity.constrained'],
    listensFor: ['delivery.delayed', 'capacity.constrained', 'marketing.demand_spike_incoming'],
  },
  // ===== FINANCE LAYER (5) =====
  {
    id: 'bookkeeping',
    name: 'Bookkeeping',
    layer: 'FINANCE',
    role: 'SUB_AGENT',
    responsibility: 'Manages daily bookkeeping, transaction categorization, and financial record keeping.',
    status: 'IDLE',
    emits: ['expense.spike', 'revenue.milestone_hit'],
    listensFor: ['cashflow.risk', 'expense.spike'],
  },
  {
    id: 'cashflow-forecasting',
    name: 'Cashflow Forecasting',
    layer: 'FINANCE',
    role: 'SUB_AGENT',
    responsibility: 'Forecasts cash flow, identifies financial risks, and manages runway projections.',
    status: 'IDLE',
    emits: ['cashflow.risk'],
    listensFor: ['cashflow.risk', 'expense.spike', 'revenue.milestone_hit'],
  },
  {
    id: 'pricing-unit-economics',
    name: 'Pricing & Unit Economics',
    layer: 'FINANCE',
    role: 'SUB_AGENT',
    responsibility: 'Analyzes unit economics, pricing strategies, margin optimization, and profitability.',
    status: 'IDLE',
    emits: ['pricing.benchmark_changed'],
    listensFor: ['pricing.benchmark_changed', 'cashflow.risk'],
  },
  {
    id: 'compliance-tax',
    name: 'Compliance & Tax',
    layer: 'FINANCE',
    role: 'SUB_AGENT',
    responsibility: 'Handles tax compliance, regulatory filings, GST management, and legal compliance.',
    status: 'IDLE',
    emits: ['cashflow.risk'],
    listensFor: ['cashflow.risk', 'finance.budget_cut'],
  },
  {
    id: 'fundraising-investor-relations',
    name: 'Fundraising & Investor Relations',
    layer: 'FINANCE',
    role: 'SUB_AGENT',
    responsibility: 'Manages investor communications, fundraising preparation, pitch deck updates, and reporting.',
    status: 'IDLE',
    emits: ['revenue.milestone_hit'],
    listensFor: ['revenue.milestone_hit', 'cashflow.risk'],
  },
  // ===== LAYER ORCHESTRATORS (4) =====
  {
    id: 'research-orchestrator',
    name: 'Research Layer Orchestrator',
    layer: 'RESEARCH',
    role: 'LAYER_ORCHESTRATOR',
    responsibility: 'Coordinates all research sub-agents, manages research priorities, and synthesizes intelligence.',
    status: 'IDLE',
    emits: ['research.requested'],
    listensFor: ['competitor.detected', 'market.trend_shift', 'pricing.benchmark_changed'],
  },
  {
    id: 'marketing-orchestrator',
    name: 'Marketing Layer Orchestrator',
    layer: 'MARKETING',
    role: 'LAYER_ORCHESTRATOR',
    responsibility: 'Coordinates marketing sub-agents, aligns campaigns, and manages marketing budget.',
    status: 'IDLE',
    emits: ['lead_source.underperforming', 'campaign.budget_exhausted'],
    listensFor: ['demand_spike_incoming', 'audience.segment_shift'],
  },
  {
    id: 'operations-orchestrator',
    name: 'Operations Layer Orchestrator',
    layer: 'OPERATIONS',
    role: 'LAYER_ORCHESTRATOR',
    responsibility: 'Coordinates operations sub-agents, manages workflows, and ensures operational efficiency.',
    status: 'IDLE',
    emits: ['delivery.delayed', 'capacity.constrained'],
    listensFor: ['delivery.delayed', 'capacity.constrained', 'quality.issue_detected'],
  },
  {
    id: 'finance-orchestrator',
    name: 'Finance Layer Orchestrator',
    layer: 'FINANCE',
    role: 'LAYER_ORCHESTRATOR',
    responsibility: 'Coordinates finance sub-agents, manages financial strategy, and monitors fiscal health.',
    status: 'IDLE',
    emits: ['cashflow.risk', 'expense.spike', 'revenue.milestone_hit'],
    listensFor: ['cashflow.risk', 'expense.spike', 'finance.budget_constraint', 'finance.budget_cut'],
  },
  // ===== GLOBAL ORCHESTRATOR (1) =====
  {
    id: 'global-orchestrator',
    name: 'Global Orchestrator',
    layer: 'GLOBAL',
    role: 'GLOBAL_ORCHESTRATOR',
    responsibility: 'Top-level orchestrator that routes messages, coordinates cross-layer events, and maintains system coherence.',
    status: 'IDLE',
    emits: ['task.created', 'task.completed', 'agent.status_changed'],
    listensFor: ['*'],
  },
];

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
  ) {}

  async seedAgents(founderId: string) {
    const existing = await this.prisma.agent.findMany({
      where: { founderId },
    });

    if (existing.length > 0) return existing;

    const agents = await Promise.all(
      AGENT_REGISTRY.map((def) =>
        this.prisma.agent.create({
          data: {
            id: def.id,
            name: def.name,
            layer: def.layer,
            role: def.role,
            responsibility: def.responsibility,
            status: def.status,
            founderId,
            metrics: {
              tasksCompleted: 0,
              tasksFailed: 0,
              avgResponseMs: 0,
            },
          },
        }),
      ),
    );

    for (const def of AGENT_REGISTRY) {
      if (def.listensFor.length > 0) {
        await this.eventService.subscribe(def.id, def.listensFor);
      }
    }

    this.logger.log(`Seeded ${agents.length} agents for founder ${founderId}`);
    return agents;
  }

  async listAll(founderId: string) {
    const dbAgents = await this.prisma.agent.findMany({
      where: { founderId },
      orderBy: [{ layer: 'asc' }, { role: 'desc' }, { name: 'asc' }],
    });

    const registryMap = new Map(AGENT_REGISTRY.map((a) => [a.id, a]));

    return dbAgents.map((agent) => {
      const registry = registryMap.get(agent.id);
      return {
        ...agent,
        emits: registry?.emits || [],
        listensFor: registry?.listensFor || [],
      };
    });
  }

  async findById(id: string, founderId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, founderId },
    });
    if (!agent) return null;

    const registry = AGENT_REGISTRY.find((a) => a.id === id);
    return {
      ...agent,
      emits: registry?.emits || [],
      listensFor: registry?.listensFor || [],
    };
  }

  async updateStatus(id: string, founderId: string, status: string) {
    const agent = await this.prisma.agent.update({
      where: { id, founderId },
      data: { status },
    });

    await this.eventService.publish({
      type: 'agent.status_changed',
      publisher: 'system',
      payload: { agentId: id, oldStatus: agent.status, newStatus: status },
    });

    return agent;
  }

  async getActivity(agentId: string, founderId: string) {
    return this.prisma.activityLog.findMany({
      where: { founderId, agentId },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });
  }

  getRegistry(): AgentDefinition[] {
    return AGENT_REGISTRY;
  }
}
