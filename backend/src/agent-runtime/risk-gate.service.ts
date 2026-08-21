import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { ToolDefinition, ToolCall, RiskTier } from './types';

interface RiskFactors {
  isReadOnly: boolean;
  riskTier: string;
  hasSpendLimit: boolean;
  spendAmount?: number;
  isBlockedVendor: boolean;
  isExternalComm: boolean;
  isDestructive: boolean;
  layerSpecific: boolean;
  timeRestricted: boolean;
}

@Injectable()
export class RiskGateService {
  private readonly logger = new Logger(RiskGateService.name);

  // External communication tools that always need approval
  private readonly EXTERNAL_TOOLS = new Set(['send_email', 'create_social_post']);
  // Destructive tools
  private readonly DESTRUCTIVE_TOOLS = new Set(['delete', 'remove', 'cancel']);
  // Finance-layer tools that always need approval
  private readonly FINANCE_TOOLS = new Set(['compliance-tax', 'fundraising-investor-relations']);

  constructor(private prisma: PrismaService, private events: EventService) {}

  async check(
    tool: ToolDefinition, toolCall: ToolCall,
    taskId: string, agentId: string, founderId: string, layer: string,
  ): Promise<{ allowed: boolean; approvalId?: string; reason?: string; riskFactors: string[] }> {
    // 1. Read-only tools always pass
    if (tool.isReadOnly) return { allowed: true, riskFactors: [] };

    // 2. Analyze risk factors
    const factors = this.analyzeRiskFactors(tool, toolCall, layer, founderId);
    const riskScore = this.calculateRiskScore(factors);

    // 3. Get founder's autonomy settings
    const autonomySettings = await this.getAutonomySettings(founderId);
    const layerConfig = autonomySettings[layer.toLowerCase()] || autonomySettings.global;
    const maxAutoTier = layerConfig?.defaultTier || 'NOTIFY_AND_ACT';

    // 4. Override risk tier based on context
    let effectiveTier = tool.riskTier || 'AUTO_EXECUTE';

    // High-risk factors escalate the tier
    if (factors.isExternalComm && effectiveTier === 'AUTO_EXECUTE') {
      effectiveTier = RiskTier.APPROVAL_REQUIRED;
    }
    if (factors.isDestructive && effectiveTier !== RiskTier.APPROVAL_REQUIRED) {
      effectiveTier = RiskTier.APPROVAL_REQUIRED;
    }
    if (factors.isBlockedVendor) {
      return { allowed: false, reason: 'Vendor is blocked by founder settings', riskFactors: ['blocked_vendor'] };
    }
    if (factors.hasSpendLimit && factors.spendAmount && factors.spendAmount > (layerConfig?.spendLimit || 0)) {
      effectiveTier = RiskTier.APPROVAL_REQUIRED;
    }
    if (factors.timeRestricted && this.isOutsideBusinessHours()) {
      effectiveTier = RiskTier.NOTIFY_AND_ACT;
    }

    // 5. Apply the tier
    this.logger.log(`Risk gate: ${tool.name} → tier=${effectiveTier} score=${riskScore} factors=${factors}`);

    if (effectiveTier === 'AUTO_EXECUTE') {
      return { allowed: true, riskFactors: this.factorNames(factors) };
    }

    if (effectiveTier === 'NOTIFY_AND_ACT') {
      await this.events.publish({
        type: 'risk.notify_and_act', publisher: agentId,
        payload: { taskId, tool: tool.name, tier: effectiveTier, riskScore, factors: this.factorNames(factors) } as any,
        founderId,
      });
      return { allowed: true, riskFactors: this.factorNames(factors) };
    }

    if (effectiveTier === 'APPROVAL_REQUIRED') {
      const approval = await this.prisma.approval.create({
        data: {
          taskId, agentId, layer,
          action: JSON.stringify({ tool: tool.name, arguments: toolCall.arguments }),
          reasoning: this.buildApprovalReasoning(tool, factors, riskScore),
          riskTier: effectiveTier,
          riskFactors: this.factorNames(factors),
          status: 'PENDING',
          founderId,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      await this.events.publish({
        type: 'approval.requested', publisher: agentId,
        payload: { approvalId: approval.id, taskId, riskScore, factors: this.factorNames(factors) } as any,
        founderId,
      });
      this.logger.log(`Task ${taskId} blocked by risk gate: ${tool.name} (score=${riskScore})`);
      return { allowed: false, approvalId: approval.id, reason: 'Approval required', riskFactors: this.factorNames(factors) };
    }

    return { allowed: true, riskFactors: [] };
  }

  // ─── Risk Analysis ────────────────────────────────────────────────────

  private analyzeRiskFactors(tool: ToolDefinition, toolCall: ToolCall, layer: string, founderId: string): RiskFactors {
    return {
      isReadOnly: tool.isReadOnly,
      riskTier: tool.riskTier,
      hasSpendLimit: this.EXTERNAL_TOOLS.has(tool.name) || tool.name === 'schedule_action',
      spendAmount: this.extractSpendAmount(toolCall),
      isBlockedVendor: false, // Would check against founder settings
      isExternalComm: this.EXTERNAL_TOOLS.has(tool.name),
      isDestructive: this.isDestructiveTool(tool, toolCall),
      layerSpecific: layer === 'FINANCE',
      timeRestricted: layer === 'MARKETING', // Marketing posts have time restrictions
    };
  }

  private calculateRiskScore(factors: RiskFactors): number {
    let score = 0;
    if (factors.isReadOnly) return 0;
    if (factors.riskTier === 'APPROVAL_REQUIRED') score += 40;
    if (factors.riskTier === 'NOTIFY_AND_ACT') score += 20;
    if (factors.isExternalComm) score += 30;
    if (factors.isDestructive) score += 50;
    if (factors.layerSpecific) score += 10;
    if (factors.timeRestricted) score += 5;
    if (factors.hasSpendLimit && factors.spendAmount && factors.spendAmount > 1000) score += 20;
    return Math.min(100, score);
  }

  private extractSpendAmount(toolCall: ToolCall): number | undefined {
    const args = toolCall.arguments;
    if (typeof args.amount === 'number') return args.amount;
    if (typeof args.spend === 'number') return args.spend;
    if (typeof args.budget === 'number') return args.budget;
    return undefined;
  }

  private isDestructiveTool(tool: ToolDefinition, _toolCall: ToolCall): boolean {
    for (const keyword of this.DESTRUCTIVE_TOOLS) {
      if (tool.name.toLowerCase().includes(keyword)) return true;
    }
    return false;
  }

  private isOutsideBusinessHours(): boolean {
    const hour = new Date().getUTCHours();
    return hour < 6 || hour > 22; // Before 6am or after 10pm UTC
  }

  private factorNames(factors: RiskFactors): string[] {
    const names: string[] = [];
    if (factors.isExternalComm) names.push('external_communication');
    if (factors.isDestructive) names.push('destructive_action');
    if (factors.hasSpendLimit) names.push('spend_limit');
    if (factors.layerSpecific) names.push('finance_layer');
    if (factors.timeRestricted) names.push('time_restricted');
    return names;
  }

  private buildApprovalReasoning(tool: ToolDefinition, factors: RiskFactors, riskScore: number): string {
    const parts: string[] = [`Tool "${tool.name}" requires approval.`];
    if (factors.isExternalComm) parts.push('This sends external communications.');
    if (factors.isDestructive) parts.push('This action may be destructive or irreversible.');
    if (factors.hasSpendLimit && factors.spendAmount) parts.push(`Estimated spend: $${factors.spendAmount}`);
    if (factors.layerSpecific) parts.push('Finance-layer actions always require approval.');
    parts.push(`Risk score: ${riskScore}/100`);
    return parts.join(' ');
  }

  // ─── Founder Autonomy Settings ────────────────────────────────────────

  private async getAutonomySettings(founderId: string): Promise<any> {
    const founder = await this.prisma.founder.findUnique({ where: { id: founderId } });
    if (!founder) return {};

    const settings = (founder.autonomySettings as Record<string, any>) || {};
    return {
      research: settings.research || { defaultTier: 'AUTO_EXECUTE' },
      marketing: settings.marketing || { defaultTier: 'NOTIFY_AND_ACT' },
      operations: settings.operations || { defaultTier: 'NOTIFY_AND_ACT' },
      finance: settings.finance || { defaultTier: 'APPROVAL_REQUIRED' },
      global: settings.global || { defaultTier: 'NOTIFY_AND_ACT' },
    };
  }
}
