import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { TaskService } from '../tasks/tasks.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly taskService: TaskService,
    private readonly activityService: ActivityService,
    private readonly config: ConfigService,
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
      payload: { approvalId: approval.id, taskId: data.taskId, action: data.action },
    });

    await this.activityService.logActivity({
      founderId: data.founderId,
      type: 'APPROVAL_REQUESTED',
      description: `Approval needed for: ${data.action}`,
      agentId: data.agentId,
    });

    return approval;
  }

  async getPendingQueue(founderId: string) {
    return this.prisma.approval.findMany({
      where: {
        founderId,
        status: 'PENDING',
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      include: { task: true },
    });
  }

  async approve(id: string, founderId: string) {
    const approval = await this.prisma.approval.findFirst({
      where: { id, founderId, status: 'PENDING' },
    });
    if (!approval) throw new NotFoundException('Approval not found or already resolved');

    await this.prisma.approval.update({
      where: { id },
      data: { status: 'APPROVED', resolvedAt: new Date(), resolution: 'Approved by founder' },
    });

    await this.taskService.resumeTask(approval.taskId);

    await this.eventService.publish({
      type: 'approval.resolved',
      publisher: 'founder',
      payload: {
        approvalId: id,
        taskId: approval.taskId,
        status: 'APPROVED',
      },
      correlationId: approval.taskId,
    });

    await this.activityService.logActivity({
      founderId,
      type: 'APPROVAL_RESOLVED',
      description: `Approved: ${approval.action}`,
    });

    return this.prisma.approval.findUnique({ where: { id }, include: { task: true } });
  }

  async reject(id: string, founderId: string, reason?: string) {
    const approval = await this.prisma.approval.findFirst({
      where: { id, founderId, status: 'PENDING' },
    });
    if (!approval) throw new NotFoundException('Approval not found or already resolved');

    await this.prisma.approval.update({
      where: { id },
      data: {
        status: 'REJECTED',
        resolvedAt: new Date(),
        resolution: reason || 'Rejected by founder',
      },
    });

    await this.taskService.failTask(approval.taskId, `Rejected by founder: ${reason || 'No reason given'}`);

    await this.eventService.publish({
      type: 'approval.resolved',
      publisher: 'founder',
      payload: {
        approvalId: id,
        taskId: approval.taskId,
        status: 'REJECTED',
        reason,
      },
      correlationId: approval.taskId,
    });

    await this.activityService.logActivity({
      founderId,
      type: 'APPROVAL_RESOLVED',
      description: `Rejected: ${approval.action} — ${reason || 'No reason'}`,
    });

    return this.prisma.approval.findUnique({ where: { id }, include: { task: true } });
  }

  async edit(id: string, founderId: string, editedAction: string) {
    if (!editedAction) {
      throw new BadRequestException('editedAction is required');
    }

    const approval = await this.prisma.approval.findFirst({
      where: { id, founderId, status: 'PENDING' },
    });
    if (!approval) throw new NotFoundException('Approval not found or already resolved');

    await this.prisma.approval.update({
      where: { id },
      data: {
        status: 'EDITED',
        editedAction,
        resolvedAt: new Date(),
        resolution: `Founder edited action: ${editedAction}`,
      },
    });

    await this.taskService.resumeTask(approval.taskId);

    await this.eventService.publish({
      type: 'approval.resolved',
      publisher: 'founder',
      payload: {
        approvalId: id,
        taskId: approval.taskId,
        status: 'EDITED',
        editedAction,
      },
      correlationId: approval.taskId,
    });

    await this.activityService.logActivity({
      founderId,
      type: 'APPROVAL_RESOLVED',
      description: `Edited and approved: ${editedAction}`,
    });

    return this.prisma.approval.findUnique({ where: { id }, include: { task: true } });
  }

  async expireStaleApprovals() {
    const stale = await this.prisma.approval.findMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
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
