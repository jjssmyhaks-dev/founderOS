import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { ActivityService } from '../activity/activity.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ContextCompletenessService } from '../onboarding/context-completeness.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private orchestrator: OrchestrationService,
    private activity: ActivityService,
    private onboarding: OnboardingService,
    private completeness: ContextCompletenessService,
  ) {}

  async handleMessage(founderId: string, content: string, sessionId?: string) {
    let session;
    try {
      if (sessionId) {
        session = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
      }
      if (!session) {
        session = await this.prisma.chatSession.create({
          data: { founderId, title: content.slice(0, 60) },
        });
      }
    } catch (err) {
      this.logger.error(`Failed to get/create session: ${String(err)}`);
      throw err;
    }

    try {
      await this.prisma.chatMessage.create({
        data: { founderId, sessionId: session.id, role: 'FOUNDER', content },
      });
    } catch (err) {
      this.logger.error(`Failed to store founder message: ${String(err)}`);
    }

    try {
      const isOnboardingComplete = await this.onboarding.isOnboardingComplete(founderId);

      if (!isOnboardingComplete) {
        const result = await this.onboarding.handleOnboardingMessage(founderId, content);

        await this.prisma.chatMessage.create({
          data: {
            founderId, sessionId: session.id, role: 'AGENT',
            content: result.response, agentId: 'global-orchestrator', layer: 'GLOBAL',
            metadata: { onboarding: true, isOnboarding: result.isOnboarding },
          },
        });

        if (!result.isOnboarding) {
          await this.onboarding.markOnboardingComplete(founderId);
        }

        return {
          sessionId: session.id,
          message: { id: uuid(), role: 'FOUNDER', content, sessionId: session.id },
          response: {
            id: uuid(), role: 'AGENT', content: result.response,
            agentId: 'global-orchestrator', layer: 'GLOBAL',
            sessionId: session.id, createdAt: new Date().toISOString(),
            metadata: { onboarding: true, isOnboarding: result.isOnboarding },
          },
          isOnboarding: result.isOnboarding,
        };
      }
    } catch (err) {
      this.logger.error(`Onboarding failed, falling through to normal routing: ${String(err)}`);
    }

    // Normal routing through orchestrator
    try {
      const response = await this.orchestrator.routeMessage(founderId, content);

      await this.prisma.chatMessage.create({
        data: {
          founderId, sessionId: session.id, role: 'AGENT',
          content: response.content, agentId: response.agentId,
          layer: response.layer, metadata: response.metadata,
        },
      });

      return {
        sessionId: session.id,
        message: { id: uuid(), role: 'FOUNDER', content, sessionId: session.id },
        response: {
          id: uuid(), role: 'AGENT', content: response.content,
          agentId: response.agentId, layer: response.layer,
          sessionId: session.id, createdAt: new Date().toISOString(),
        },
        isOnboarding: false,
      };
    } catch (err) {
      this.logger.error(`Orchestrator failed: ${String(err)}`);

      const errorMsg = 'I ran into an issue processing that. Could you try rephrasing or breaking it into smaller steps?';
      await this.prisma.chatMessage.create({
        data: {
          founderId, sessionId: session.id, role: 'AGENT',
          content: errorMsg, agentId: 'global-orchestrator', layer: 'GLOBAL',
          metadata: { error: true },
        },
      });

      return {
        sessionId: session.id,
        message: { id: uuid(), role: 'FOUNDER', content, sessionId: session.id },
        response: {
          id: uuid(), role: 'AGENT', content: errorMsg,
          agentId: 'global-orchestrator', layer: 'GLOBAL',
          sessionId: session.id, createdAt: new Date().toISOString(),
        },
        isOnboarding: false,
      };
    }
  }

  async handleVoice(founderId: string, audioDataBase64: string, format?: string) {
    return this.handleMessage(founderId, '[Voice input received. STT integration required.]');
  }

  async getHistory(founderId: string, sessionId?: string) {
    const where: any = { founderId };
    if (sessionId) where.sessionId = sessionId;
    const messages = await this.prisma.chatMessage.findMany({
      where, orderBy: { createdAt: 'asc' }, take: 100,
    });
    return { messages, sessionId };
  }

  async getSessions(founderId: string) {
    return this.prisma.chatSession.findMany({
      where: { founderId }, orderBy: { updatedAt: 'desc' }, take: 20,
    });
  }

  async getContextCompleteness(founderId: string) {
    return this.completeness.getCompleteness(founderId);
  }
}
