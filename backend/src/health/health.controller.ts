import { Controller, Get, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import Redis from 'ioredis';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async check() {
    const services: Record<string, unknown> = {
      database: 'unknown',
      redis: 'unknown',
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    };

    let status = 'ok';

    // Check database connectivity
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      services.database = 'connected';
    } catch (e) {
      services.database = 'disconnected';
      status = 'degraded';
      this.logger.warn('Database health check failed: ' + String(e));
    }

    // Check Redis connectivity
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      let redis: Redis | null = null;
      try {
        redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 3000, lazyConnect: true });
        await redis.connect();
        await redis.ping();
        services.redis = 'connected';
        await redis.quit();
      } catch (e) {
        services.redis = 'disconnected';
        status = 'degraded';
        this.logger.warn('Redis health check failed: ' + String(e));
        if (redis) redis.disconnect();
      }
    } else {
      services.redis = 'not_configured';
    }

    if (status === 'degraded') {
      const errors: string[] = [];
      if (services.database === 'disconnected') errors.push('database');
      if (services.redis === 'disconnected') errors.push('redis');
      this.logger.warn(`Health degraded: ${errors.join(', ')}`);
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '0.1.0',
      services,
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check for load balancers' })
  @ApiResponse({ status: 200, description: 'Service is ready to accept traffic' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ready', timestamp: new Date().toISOString() };
    } catch (e) {
      throw new Error('Service not ready: database unavailable');
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check for orchestrators' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  live() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }
}
