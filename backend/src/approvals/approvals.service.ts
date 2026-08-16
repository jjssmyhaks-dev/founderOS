import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { EventService } from '../events/events.service';
import { TaskService } from '../tasks/tasks.service';
import { ActivityService } from '../activity/activity.service';
import { AuthSecurityService } from '../common/services/auth-security.service';
import { Request } from 'express';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly taskService: TaskService,
    private readonly activityService: ActivityService,
    private readonly config: ConfigService,
    private readonly security: AuthSecurityService,
  ) {}

  async createApproval(data: {
    taskId: string;
    agentId: string;
    layer: string;
    action: string;
    reasoning: string;
    riskTier: string;
    riskFactors: string[];
    founderId: string;
  }) {
    const expiryHours = parseInt(
      this.config.get<string>('APPROVAL_EXPIRY_HOURS') || '24',
      10,
    );
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    const approval = await this.prisma.approval.create({
      data: {
        taskId: data.taskId,
        agentId: data.agentId,
        layer: data.layer,
        action: data.action,
        reasoning: data.reasoning,
        riskTier: data.riskTier,
        riskFactors: data.riskFactors,
        founderId: data.founderId,
        expiresAt,
      },
    });

    await this.taskService.blockTask(data.taskId, `Awaiting approval: ${data.action}`);

    await this.eventService.publish({
      type: 'approval.requested',
      publisher: data.agentId,
      payload: { approvalId: approval.id, taskId: data.taskId, action: data.action, founderId: data.founderId },
    });

    await this.activityService.logActivity({
      founderId: data.founderId,
      type: 'APPROVAL_REQUESTED',
      description: `Approval needed for: ${data.action}`,
      agentId: data.agentId,
    });

    return approval;
  }

  private async verifyOwnership(id: string, founderId: string, req?: Request) {
    const approval = await this.prisma.approval.findUnique({ where: { id } });

    if (!approval) throw new NotFoundException('Approval not found');

    // Explicit founder_id mismatch check per Auth & Multi-Tenancy spec Section 4.4
    if (approval.founderId !== founderId) {
      const ip = (req as any)?.ip || (req as any)?.connection?.remoteAddress;
      await this.security.logApprovalMismatch(id, approval.founderId, founderId, ip);
      throw new ForbiddenException('Authorization failure: approval does not belong to this founder');
    }

    if (approval.status !== 'PENDING') {
      throw new BadRequestException('Approval already resolved');
    }

    return approval;
  }

  async approve(id: string, founderId: string, req?: Request) {
    const approval = await this.verifyOwnership(id, founderId, req);

    await this.prisma.approval.update({
      where: { id },
      data: { status: 'APPROVED', resolvedAt: new Date(), resolution: 'Approved by founder' },
    });

    await this.taskService.resumeTask(approval.taskId);

    await this.eventService.publish({
      type: 'approval.resolved',
      publisher: 'founder',
      payload: { approvalId: id, taskId: approval.taskId, status: 'APPROVED', founderId },
      correlationId: approval.taskId,
    });

    await this.activityService.logActivity({
      founderId,
      type: 'APPROVAL_RESOLVED',
      description: `Approved: ${approval.action}`,
    });

    return this.prisma.approval.findUnique({ where: { id }, include: { task: true } });
  }

  async reject(id: string, founderId: string, reason?: string, req?: Request) {
    const approval = await this.verifyOwnership(id, founderId, req);

    await this.prisma.approval.update({
      where: { id },
      data: { status: 'REJECTED', resolvedAt: new Date(), resolution: reason || 'Rejected by founder' },
    });

    await this.taskService.failTask(approval.taskId, `Rejected by founder: ${reason || 'No reason given'}`);

    await this.eventService.publish({
      type: 'approval.resolved',
      publisher: 'founder',
      payload: { approvalId: id, taskId: approval.taskId, status: 'REJECTED', reason, founderId },
      correlationId: approval.taskId,
    });

    await this.activityService.logActivity({
      founderId,
      type: 'APPROVAL_RESOLVED',
      description: `Rejected: ${approval.action} — ${reason || 'No reason'}`,
    });

    return this.prisma.approval.findUnique({ where: { id }, include: { task: true } });
  }

  async edit(id: string, founderId: string, editedAction: string, req?: Request) {
    if (!editedAction) throw new BadRequestException('editedAction is required');
    const approval = await this.verifyOwnership(id, founderId, req);

    await this.prisma.approval.update({
      where: { id },
      data: { status: 'EDITED', editedAction, resolvedAt: new Date(), resolution: `Founder edited action: ${editedAction}` },
    });

    await this.taskService.resumeTask(approval.taskId);

    await this.eventService.publish({
      type: 'approval.resolved',
      publisher: 'founder',
      payload: { approvalId: id, taskId: approval.taskId, status: 'EDITED', editedAction, founderId },
      correlationId: approval.taskId,
    });

    await this.activityService.logActivity({
      founderId,
      type: 'APPROVAL_RESOLVED',
      description: `Edited and approved: ${editedAction}`,
    });

    return this.prisma.approval.findUnique({ where: { id }, include: { task: true } });
  }

  async getPendingQueue(founderId: string) {
    return this.prisma.approval.findMany({
      where: { founderId, status: 'PENDING', expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'asc' },
      include: { task: true },
    });
  }

  async expireStaleApprovals() {
    const stale = await this.prisma.approval.findMany({
      where: { status: 'PENDING', expiresAt: { lt: new Date() } },
    });

    for (const approval of stale) {
      await this.prisma.approval.update({
        where: { id: approval.id },
        data: { status: 'EXPIRED', resolvedAt: new Date(), resolution: 'Approval expired' },
      });
      await this.taskService.failTask(approval.taskId, `Approval expired for action: ${approval.action}`);
      this.logger.log(`Expired approval ${approval.id} for task ${approval.taskId}`);
    }

    return { expired: stale.length };
  }
}
