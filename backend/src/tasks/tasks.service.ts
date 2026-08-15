import { Prisma } from '@prisma/client';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { ActivityService } from '../activity/activity.service';
import { CreateTaskDto, UpdateTaskStatusDto } from './dto/tasks.dto';

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly activityService: ActivityService,
  ) {}

  async create(founderId: string, dto: CreateTaskDto, agentId?: string) {
    const layer = dto.layer || 'RESEARCH';
    const riskTier = this.evaluateRiskTier(dto.title, dto.description, layer);

    const task = await this.prisma.task.create({
      data: {
        founderId,
        layer,
        agentId: agentId || null,
        title: dto.title,
        description: dto.description,
        riskTier,
        priority: dto.priority || 'MEDIUM',
        parentTaskId: dto.parentTaskId || null,
        metadata: (dto.metadata as any) ?? Prisma.JsonNull,
      },
    });

    await this.eventService.publish({
      type: 'task.created',
      publisher: agentId || 'system',
      payload: { taskId: task.id, layer: task.layer, riskTier: task.riskTier },
    });

    await this.activityService.logActivity({
      founderId,
      type: 'TASK_STARTED',
      description: `Task created: ${task.title}`,
      agentId,
    });

    if (riskTier === 'AUTO_EXECUTE') {
      this.executeTask(task.id, founderId).catch((err) =>
        this.logger.error(`Auto-execute failed for ${task.id}: ${err}`),
      );
    }

    return task;
  }

  async findOne(id: string, founderId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, founderId },
      include: { approvals: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async updateStatus(id: string, founderId: string, dto: UpdateTaskStatusDto) {
    const task = await this.prisma.task.findFirst({ where: { id, founderId } });
    if (!task) throw new NotFoundException('Task not found');

    const updateData: Record<string, unknown> = {
      status: dto.status,
    };

    if (dto.status === 'IN_PROGRESS' && !task.startedAt) {
      updateData.startedAt = new Date();
    }

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(dto.status)) {
      updateData.completedAt = new Date();
    }

    if (dto.result) updateData.result = dto.result;
    if (dto.error) updateData.error = dto.error;

    const updated = await this.prisma.task.update({
      where: { id },
      data: updateData,
    });

    const eventType =
      dto.status === 'COMPLETED'
        ? 'task.completed'
        : dto.status === 'FAILED'
          ? 'task.failed'
          : 'agent.status_changed';

    await this.eventService.publish({
      type: eventType,
      publisher: 'system',
      payload: { taskId: id, status: dto.status },
    });

    return updated;
  }

  async findAll(founderId: string, filters?: { layer?: string; status?: string; agentId?: string; limit?: number; offset?: number }) {
    const where: Record<string, unknown> = { founderId };
    if (filters?.layer) where.layer = filters.layer;
    if (filters?.status) where.status = filters.status;
    if (filters?.agentId) where.agentId = filters.agentId;

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.task.count({ where }),
    ]);

    return { items, total, limit, offset };
  }

  async blockTask(taskId: string, reason: string) {
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'BLOCKED', error: reason },
    });
  }

  async resumeTask(taskId: string) {
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
  }

  async failTask(taskId: string, reason: string) {
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'FAILED', error: reason, completedAt: new Date() },
    });
    await this.eventService.publish({
      type: 'task.failed',
      publisher: 'system',
      payload: { taskId, reason },
    });
  }

  private async executeTask(taskId: string, founderId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return;

    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });

    await this.prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        result: `Auto-executed: ${task.title}`,
        completedAt: new Date(),
      },
    });

    await this.eventService.publish({
      type: 'task.completed',
      publisher: task.agentId || 'system',
      payload: { taskId, layer: task.layer },
    });

    await this.activityService.logActivity({
      founderId,
      type: 'TASK_COMPLETED',
      description: `Task auto-completed: ${task.title}`,
      agentId: task.agentId || undefined,
    });
  }

  private evaluateRiskTier(title: string, _description: string, _layer: string): string {
    const lowerTitle = title.toLowerCase();
    const highRiskKeywords = [
      'delete', 'remove', 'payment', 'refund', 'fire', 'terminate',
      'money', 'bank', 'salary', 'invoice', 'tax', 'legal',
      'shutdown', 'deploy', 'publish', 'send email', 'bulk',
    ];

    for (const keyword of highRiskKeywords) {
      if (lowerTitle.includes(keyword)) return 'APPROVAL_REQUIRED';
    }

    const mediumRiskKeywords = [
      'update', 'change', 'modify', 'create', 'add', 'schedule',
      'contact', 'message', 'post', 'campaign', 'ad',
    ];

    for (const keyword of mediumRiskKeywords) {
      if (lowerTitle.includes(keyword)) return 'NOTIFY_AND_ACT';
    }

    return 'AUTO_EXECUTE';
  }
}
