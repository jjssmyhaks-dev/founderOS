import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { ActivityService } from '../activity/activity.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private orchestrator: OrchestrationService,
    private activity: ActivityService,
  ) {}

  async handleMessage(founderId: string, content: string, sessionId?: string) {
    // Get or create session
    let session;
    if (sessionId) {
      session = await this.prisma.chatSession.findUnique({ where: { id: sessionId } });
    }
    if (!session) {
      session = await this.prisma.chatSession.create({
        data: {
          founderId,
          title: content.slice(0, 60),
        },
      });
    }

    // Store founder message
    await this.prisma.chatMessage.create({
      data: {
        founderId,
        sessionId: session.id,
        role: 'FOUNDER',
        content,
      },
    });

    // Route through orchestrator
    const response = await this.orchestrator.routeMessage(founderId, content);

    // Store agent response
    await this.prisma.chatMessage.create({
      data: {
        founderId,
        sessionId: session.id,
        role: 'AGENT',
        content: response.content,
        agentId: response.agentId,
        layer: response.layer,
        metadata: response.metadata,
      },
    });

    // Update session title if first message
    if (session.title === content.slice(0, 60)) {
      await this.prisma.chatSession.update({
        where: { id: session.id },
        data: { title: content.slice(0, 60) },
      });
    }

    return {
      sessionId: session.id,
      message: { id: uuid(), role: 'FOUNDER', content, sessionId: session.id },
      response: {
        id: uuid(),
        role: 'AGENT',
        content: response.content,
        agentId: response.agentId,
        layer: response.layer,
        sessionId: session.id,
        createdAt: new Date().toISOString(),
      },
    };
  }

  async handleVoice(founderId: string, audioDataBase64: string, format?: string) {
    // In production: send to STT provider (Deepgram/ElevenLabs/OpenAI)
    // For now, return a placeholder that voice is received
    const transcript = '[Voice input received. STT provider integration required.]';
    return this.handleMessage(founderId, transcript);
  }

  async getHistory(founderId: string, sessionId?: string) {
    const where: any = { founderId };
    if (sessionId) where.sessionId = sessionId;

    const messages = await this.prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return { messages, sessionId };
  }

  async getSessions(founderId: string) {
    return this.prisma.chatSession.findMany({
      where: { founderId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });
  }
}
