import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import { TraceService } from '../observability/trace.service';
import { EventService } from '../events/events.service';
import { TaskService } from '../tasks/tasks.service';
import { ContextService } from '../context/context.service';
import { ActivityService } from '../activity/activity.service';
import { ResearchLayerService } from '../layers/research/research-layer.service';
import { MarketingLayerService } from '../layers/marketing/marketing-layer.service';
import { OperationsLayerService } from '../layers/operations/operations-layer.service';
import { FinanceLayerService } from '../layers/finance/finance-layer.service';

const ROUTING_PROMPT = `You are the Global Orchestrator for Helm, an AI operating system for solo founders.

Given a founder's message, classify which functional layer should handle it and select the best sub-agent.

Layers: RESEARCH, MARKETING, OPERATIONS, FINANCE

Respond in JSON format ONLY:
{
  "layer": "LAYER_NAME",
  "agentId": "agent-id-or-null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}

If the message is a greeting, question about Helm, or doesn't clearly map to a layer, use RESEARCH as default.
If the message spans multiple layers, pick the primary one and note others in reasoning.`;

@Injectable()
export class OrchestrationService {
  private readonly logger = new Logger(OrchestrationService.name);

  constructor(
    private llm: LlmService,
    private events: EventService,
    private tasks: TaskService,
    private context: ContextService,
    private activity: ActivityService,
    private research: ResearchLayerService,
    private marketing: MarketingLayerService,
    private operations: OperationsLayerService,
    private finance: FinanceLayerService,
  ) {}

  async routeMessage(founderId: string, message: string): Promise<{
    content: string;
    agentId: string;
    layer: string;
    metadata: any;
  }> {
    this.logger.log(`Routing message for founder ${founderId}: ${message.slice(0, 80)}...`);

    // Check context for relevant prior decisions
    const context = await this.context.queryContext(founderId, message);
    const contextStr = context.length > 0 ? `\nRelevant prior context:\n${context.map(c => c.content).join('\n')}` : '';

    // Use LLM for routing
    let routing;
    try {
      const llmResponse = await this.llm.complete({
        prompt: `${ROUTING_PROMPT}${contextStr}\n\nFounder message: "${message}"`,
        system: 'You are a routing classifier. Respond with valid JSON only.',
      });

      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      routing = jsonMatch ? JSON.parse(jsonMatch[0]) : { layer: 'RESEARCH', agentId: null, confidence: 0.5, reasoning: 'Fallback routing' };
    } catch (e) {
      routing = { layer: 'RESEARCH', agentId: null, confidence: 0.3, reasoning: 'LLM routing failed, defaulting to Research' };
    }

    this.logger.log(`Routed to ${routing.layer} (${routing.confidence} confidence): ${routing.reasoning}`);

    // Route to the appropriate layer
    const layerServices: Record<string, any> = {
      RESEARCH: this.research,
      MARKETING: this.marketing,
      OPERATIONS: this.operations,
      FINANCE: this.finance,
    };

    const layerService = layerServices[routing.layer] || this.research;
    const result = await layerService.handleMessage(founderId, message, routing);

    // Log the orchestration activity
    await this.activity.logActivity({ founderId, type: 'AGENT_STATUS_CHANGE',
      description: `Message routed to ${routing.layer} layer${routing.agentId ? ` (${routing.agentId})` : ''}: ${routing.reasoning}`
    });

    return {
      content: result.content,
      agentId: routing.agentId || `${routing.layer.toLowerCase()}-orchestrator`,
      layer: routing.layer,
      metadata: { confidence: routing.confidence, reasoning: routing.reasoning, contextUsed: context.length },
    };
  }

  async getSystemHealth(founderId: string) {
    return {
      activeLayers: ['RESEARCH', 'MARKETING', 'OPERATIONS', 'FINANCE'],
      agentsOnline: 26,
      agentsTotal: 26,
    };
  }
}

