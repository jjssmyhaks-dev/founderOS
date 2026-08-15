import { Injectable, Logger } from '@nestjs/common';
import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

export interface PublishEventDto {
  type: string;
  publisher: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

@Injectable()
export class EventService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventService.name);
  private publisher: Redis;
  private subscriber: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
  }

  async onModuleInit() {
    this.subscriber.on('message', (channel, message) => {
      this.logger.verbose(`Redis message on ${channel}: ${message}`);
    });
  }

  async onModuleDestroy() {
    await this.publisher.quit();
    await this.subscriber.quit();
  }

  async publish(dto: PublishEventDto) {
    const eventId = uuidv4();
    const timestamp = new Date();

    await this.prisma.event.create({
      data: {
        id: eventId,
        type: dto.type,
        publisher: dto.publisher,
        payload: dto.payload as any,
        timestamp,
        correlationId: dto.correlationId || undefined,
      },
    });

    const channelMessage = JSON.stringify({
      id: eventId,
      type: dto.type,
      publisher: dto.publisher,
      payload: dto.payload as any,
      timestamp: timestamp.toISOString(),
      correlationId: dto.correlationId,
    });

    await this.publisher.publish(`helm:events:${dto.type}`, channelMessage);
    await this.publisher.publish('helm:events:all', channelMessage);

    const subscriptions = await this.prisma.eventSubscription.findMany({
      where: {
        eventTypes: { has: dto.type },
      },
    });

    for (const sub of subscriptions) {
      const agentChannel = `helm:agent:${sub.subscriberAgentId}:events`;
      await this.publisher.publish(agentChannel, channelMessage);
      this.logger.log(
        `Event ${dto.type} dispatched to agent ${sub.subscriberAgentId}`,
      );
    }

    this.logger.log(
      `Event published: ${dto.type} by ${dto.publisher} (id=${eventId})`,
    );
    return { eventId, type: dto.type, timestamp };
  }

  async subscribe(agentId: string, eventTypes: string[]) {
    const existing = await this.prisma.eventSubscription.findFirst({
      where: { subscriberAgentId: agentId },
    });

    if (existing) {
      await this.prisma.eventSubscription.update({
        where: { id: existing.id },
        data: { eventTypes },
      });
    } else {
      await this.prisma.eventSubscription.create({
        data: { subscriberAgentId: agentId, eventTypes },
      });
    }

    this.logger.log(`Agent ${agentId} subscribed to: ${eventTypes.join(', ')}`);
    return { agentId, eventTypes };
  }

  async getSubscriptions(agentId?: string) {
    const where = agentId ? { subscriberAgentId: agentId } : {};
    return this.prisma.eventSubscription.findMany({
      where,
    });
  }
}


