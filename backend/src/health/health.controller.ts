import { Controller, Get, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

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
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '0.1.0',
      services: {
        database: 'unknown',
        memory: {
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      },
    };

    // Check database connectivity
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.services.database = 'connected';
    } catch (e) {
      checks.services.database = 'disconnected';
      checks.status = 'degraded';
      this.logger.warn('Database health check failed: ' + String(e));
    }

    return checks;
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check for load balancers' })
  @ApiResponse({ status: 200, description: 'Service is ready to accept traffic' })
  async ready() {
    // Check database is accessible
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
