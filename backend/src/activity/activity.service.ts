import { Prisma } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LogActivityDto {
  founderId: string;
  type: string;
  description: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logActivity(dto: LogActivityDto) {
    const log = await this.prisma.activityLog.create({
      data: {
        founderId: dto.founderId,
        agentId: dto.agentId || null,
        type: dto.type,
        description: dto.description,
        metadata: (dto.metadata as any) ?? Prisma.JsonNull,
      },
    });
    return log;
  }

  async getActivityFeed(
    founderId: string,
    options?: {
      agentId?: string;
      type?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const where: Record<string, unknown> = { founderId };
    if (options?.agentId) where.agentId = options.agentId;
    if (options?.type) where.type = options.type;

    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { items, total, limit, offset };
  }
}
