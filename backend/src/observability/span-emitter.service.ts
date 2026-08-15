import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { v4 as uuidv4 } from 'uuid';

export interface SpanEmitInput {
  traceId: string;
  parentSpanId?: string;
  agentId?: string;
  taskId?: string;
  spanType: 'reasoning_step' | 'tool_call' | 'handoff' | 'approval_wait' | 'event_publish' | 'task' | 'trace';
  inputSummary?: string;
  outputSummary?: string;
  fullPayloadRef?: string;
  tokensUsed?: number;
  costEstimate?: number;
  error?: string;
  status: 'success' | 'failure' | 'timeout' | 'pending' | 'in_progress';
}

@Injectable()
export class SpanEmitterService {
  private readonly logger = new Logger(SpanEmitterService.name);
  private COST_PER_1K_TOKENS = 0.003;

  constructor(
    private prisma: PrismaService,
    private events: EventService,
  ) {}

  async emit(input: SpanEmitInput): Promise<string> {
    const spanId = uuidv4();
    const endedAt = input.status === 'in_progress' || input.status === 'pending' ? null : new Date();

    await this.prisma.span.create({
      data: {
        id: spanId,
        traceId: input.traceId,
        parentSpanId: input.parentSpanId || null,
        agentId: input.agentId || null,
        taskId: input.taskId || null,
        spanType: input.spanType,
        status: input.status,
        inputSummary: input.inputSummary || null,
        outputSummary: (input.outputSummary || '').substring(0, 500) || null,
        fullPayloadRef: input.fullPayloadRef || null,
        tokensUsed: input.tokensUsed || null,
        costEstimate: input.tokensUsed ? (input.tokensUsed / 1000) * this.COST_PER_1K_TOKENS : input.costEstimate || null,
        error: input.error || null,
        startedAt: new Date(),
        endedAt,
      },
    });

    const sysEvent = input.status === 'failure' ? 'span.failed' : input.status === 'success' ? 'span.completed' : 'span.started';
    this.events.publish({
      type: 'system.' + sysEvent, publisher: input.agentId || 'system',
      payload: { spanId, traceId: input.traceId, spanType: input.spanType, agentId: input.agentId, status: input.status, error: input.error } as any,
      correlationId: input.traceId,
    });

    return spanId;
  }

  async complete(spanId: string, output?: string, tokensUsed?: number, error?: string): Promise<void> {
    const costEstimate = tokensUsed ? (tokensUsed / 1000) * this.COST_PER_1K_TOKENS : null;
    const status = error ? 'failure' : 'success';
    await this.prisma.span.update({
      where: { id: spanId },
      data: { status, endedAt: new Date(), outputSummary: (output || '').substring(0, 500) || null, tokensUsed: tokensUsed || null, costEstimate, error: error || null },
    });
    this.events.publish({ type: 'system.' + (error ? 'span.failed' : 'span.completed'), publisher: 'system', payload: { spanId, status, error } as any });
  }
}
