import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { ToolDefinition, ToolCall } from './types';

@Injectable()
export class RiskGateService {
  private readonly logger = new Logger(RiskGateService.name);
  constructor(private prisma: PrismaService, private events: EventService) {}

  async check(tool: ToolDefinition, toolCall: ToolCall, taskId: string, agentId: string, founderId: string, layer: string): Promise<{ allowed: boolean; approvalId?: string; reason?: string }> {
    if (tool.isReadOnly) return { allowed: true };
    const tier = tool.riskTier || 'AUTO_EXECUTE';
    if (tier === 'AUTO_EXECUTE') return { allowed: true };
    if (tier === 'NOTIFY_AND_ACT') {
      await this.events.publish({ type: 'risk.notify_and_act', publisher: agentId, payload: { taskId, tool: tool.name, tier } as any });
      return { allowed: true };
    }
    if (tier === 'APPROVAL_REQUIRED') {
      const approval = await this.prisma.approval.create({
        data: { taskId, agentId, layer, action: JSON.stringify(toolCall), reasoning: 'Tool ' + tool.name + ' requires approval', riskTier: tier, riskFactors: ['Tool: ' + tool.name], status: 'PENDING', founderId, expiresAt: new Date(Date.now() + 86400000) },
      });
      await this.events.publish({ type: 'approval.requested', publisher: agentId, payload: { approvalId: approval.id, taskId } as any });
      this.logger.log('Task ' + taskId + ' blocked by risk gate');
      return { allowed: false, approvalId: approval.id, reason: 'Approval required' };
    }
    return { allowed: true };
  }
}

