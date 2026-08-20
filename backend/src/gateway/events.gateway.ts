import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' } })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly founderSockets = new Map<string, Set<string>>();
  private redisSub: Redis | null = null;

  constructor(private jwtService: JwtService) {}

  afterInit(_server: Server) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.redisSub = new Redis(redisUrl);
      this.redisSub.subscribe('helm:events:all', (err: Error | null) => {
        if (err) this.logger.warn('Redis subscribe failed: ' + String(err));
        else this.logger.log('WebSocket gateway subscribed to helm:events:all');
      });
      this.redisSub.on('message', (_channel: string, message: string) => {
        try {
          const event = JSON.parse(message);
          const founderId = event.payload?.founderId || event.correlationId;
          if (founderId) {
            this.sendToFounder(founderId, 'event:' + event.type, event.payload);
          }
        } catch (_e) {
          // Ignore parse errors
        }
      });
    } catch (e) {
      this.logger.warn('Redis connection for WS gateway failed: ' + String(e));
    }
    this.logger.log('WebSocket gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = (client.handshake.auth as Record<string, string>)?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) { client.disconnect(); return; }
      const payload = this.jwtService.verify(token) as Record<string, unknown>;
      const founderId = (payload.sub || payload.founderId) as string;
      if (!founderId) { client.disconnect(); return; }
      client.data.founderId = founderId;
      if (!this.founderSockets.has(founderId)) this.founderSockets.set(founderId, new Set());
      this.founderSockets.get(founderId)!.add(client.id);
      this.logger.log('Socket connected for founder ' + founderId);
    } catch (_e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const founderId = client.data?.founderId as string | undefined;
    if (founderId && this.founderSockets.has(founderId)) {
      this.founderSockets.get(founderId)!.delete(client.id);
      if (this.founderSockets.get(founderId)!.size === 0) this.founderSockets.delete(founderId);
    }
  }

  sendToFounder(founderId: string, event: string, data: unknown) {
    const sockets = this.founderSockets.get(founderId);
    if (!sockets || sockets.size === 0) return;
    for (const sid of sockets) {
      this.server.to(sid).emit(event, data);
    }
  }

  getConnectedCount(): number {
    return this.server.sockets.sockets.size;
  }
}
