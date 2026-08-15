// @ts-nocheck
// Type declarations for runtime-installed packages

import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000' } })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly founderSockets = new Map<string, Set<string>>();
  private redisSub: Redis | null = null;

  constructor(private jwtService: JwtService) {}

  async onModuleInit() {
    // Subscribe to Redis event bus for real-time push to connected founders
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.redisSub = new Redis(redisUrl);
      this.redisSub.subscribe('helm:events', (err) => {
        if (err) this.logger.warn('Redis subscribe failed: ' + String(err));
        else this.logger.log('WebSocket gateway subscribed to helm:events');
      });
      this.redisSub.on('message', (_channel, message) => {
        try {
          const event = JSON.parse(message);
          const founderId = event.payload?.founderId || event.correlationId;
          if (founderId) {
            this.sendToFounder(founderId, 'event:' + event.type, event.payload);
          }
        } catch (e) {
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
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) { client.disconnect(); return; }
      const payload = this.jwtService.verify(token);
      const founderId = payload.sub || payload.founderId;
      if (!founderId) { client.disconnect(); return; }
      client.data.founderId = founderId;
      if (!this.founderSockets.has(founderId)) this.founderSockets.set(founderId, new Set());
      this.founderSockets.get(founderId)!.add(client.id);
      this.logger.log('Socket connected for founder ' + founderId);
    } catch (e) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const founderId = client.data?.founderId;
    if (founderId && this.founderSockets.has(founderId)) {
      this.founderSockets.get(founderId)!.delete(client.id);
      if (this.founderSockets.get(founderId)!.size === 0) this.founderSockets.delete(founderId);
    }
  }

  sendToFounder(founderId: string, event: string, data: any) {
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
