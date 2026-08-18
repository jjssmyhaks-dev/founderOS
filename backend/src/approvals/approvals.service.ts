import { Injectable, Logger, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { ActivityService } from '../activity/activity.service';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';
import { AuthSecurityService } from '../common/services/auth-security.service';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private prisma: PrismaService,
    private events: EventService,
    private activity: ActivityService,
    private runtime: AgentRuntimeService,
    private security: AuthSecurityService,
  ) {}

  async verifyOwnership(approvalId: string, founderId: string) {
    const approval = await this.prisma.approval.findUnique({
      where: { id: approvalId },
      include: { task: true },
    });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.founderId !== founderId) {
      await this.security.logApprovalMismatch(approvalId, approval.founderId, founderId);
      throw new ForbiddenException('Not your approval');
    }
    return approval;
  }

  async getPending(founderId: string) {
    return this.prisma.approval.findMany({
      where: { founderId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async approve(approvalId: string, founderId: string) {
    const approval = await this.verifyOwnership(approvalId, founderId);

    const updated = await this.prisma.approval.update({
      where: { id: approvalId },
      data: { status: 'APPROVED', resolvedAt: new Date() },
    });

    await this.activity.logActivity({
      founderId,
      type: 'APPROVAL_APPROVED',
      description: `Approved action for task ${approval.taskId}: ${approval.action}`,
      agentId: approval.agentId,
    });

    await this.events.publish({
      type: 'approval:approved',
      publisher: 'approval-service',
      payload: { approvalId, taskId: approval.taskId },
      founderId,
    });

    // Execute the approved task
    if (approval.taskId) {
      try {
        const task = await this.prisma.task.findUnique({ where: { id: approval.taskId } });
        if (task) {
          const agentTask = {
            taskId: task.id,
            agentId: task.agentId || 'campaign-deep-dive',
            triggerType: 'orchestrator_assigned' as const,
            goal: task.description || approval.action,
            contextRefs: [],
            riskTierHint: (task.riskTier || 'NOTIFY_AND_ACT') as any,
            deadline: null,
            parentTaskId: null,
            founderId,
            layer: task.layer || 'research',
          };
          const config = {
            agentId: agentTask.agentId,
            tier: (task.riskTier || 'NOTIFY_AND_ACT') as any,
            timeoutMs: 30000,
          } as any;
          await this.runtime.executeTask(agentTask, config);
          this.logger.log(`Executed approved task ${approval.taskId}`);
        }
      } catch (err) {
        this.logger.error(`Failed to execute approved task ${approval.taskId}: ${String(err)}`);
      }
    }

    return updated;
  }

  async reject(approvalId: string, founderId: string) {
    const approval = await this.verifyOwnership(approvalId, founderId);

    const updated = await this.prisma.approval.update({
      where: { id: approvalId },
      data: { status: 'REJECTED', resolvedAt: new Date() },
    });

    if (approval.taskId) {
      await this.prisma.task.update({ where: { id: approval.taskId }, data: { status: 'CANCELLED' } });
    }

    await this.activity.logActivity({
      founderId,
      type: 'APPROVAL_REJECTED',
      description: `Rejected action for task ${approval.taskId}: ${approval.action}`,
      agentId: approval.agentId,
    });

    await this.events.publish({
      type: 'approval:rejected',
      publisher: 'approval-service',
      payload: { approvalId, taskId: approval.taskId },
      founderId,
    });

    return updated;
  }

  async edit(approvalId: string, founderId: string, editedAction: string) {
    const approval = await this.verifyOwnership(approvalId, founderId);

    const updated = await this.prisma.approval.update({
      where: { id: approvalId },
      data: { status: 'APPROVED', editedAction, resolvedAt: new Date() },
    });

    await this.activity.logActivity({
      founderId,
      type: 'APPROVAL_EDITED',
      description: `Edited and approved action for task ${approval.taskId}: ${editedAction}`,
      agentId: approval.agentId,
    });

    return updated;
  }

  async cleanupExpired() {
    const expired = await this.prisma.approval.findMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    });
    for (const approval of expired) {
      await this.prisma.approval.update({ where: { id: approval.id }, data: { status: 'EXPIRED' } });
      await this.activity.logActivity({
        founderId: approval.founderId,
        type: 'APPROVAL_EXPIRED',
        description: `Approval expired for task ${approval.taskId}`,
        agentId: approval.agentId,
      });
    }
    return expired.length;
  }
}
