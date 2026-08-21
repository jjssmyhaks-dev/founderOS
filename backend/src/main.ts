import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Global exception filter with request ID tracking
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Request ID middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).requestId = req.headers['x-request-id'] as string || randomUUID();
    next();
  });

  // Security headers middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Permissions policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Strict transport security (only in production with HTTPS)
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    // Content security policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    );
    next();
  });

  // CORS configuration
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL,
    process.env.PRODUCTION_URL,
  ].filter((v): v is string => !!v);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours preflight cache
  });

  // Request size limits and validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    exceptionFactory: (errors) => {
      const messages = errors.map((e) => {
        const constraints = e.constraints ? Object.values(e.constraints) : [];
        return `${e.property}: ${constraints.join(', ')}`;
      });
      return new Error(messages.join('; '));
    },
  }));

  // Root redirect to Swagger docs
  app.use('/', (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/' && req.method === 'GET') {
      return res.redirect(302, '/api/docs');
    }
    next();
  });

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('Helm AI OS')
    .setDescription('AI Operating System for Solo Founders — 26 autonomous agents across Research, Marketing, Operations, and Finance layers.')
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Enter your JWT token' },
      'default',
    )
    .addTag('Auth', 'Authentication and user management')
    .addTag('Chat', 'Chat sessions and messaging with agents')
    .addTag('Agents', 'Agent registry, configuration, and stats')
    .addTag('Tasks', 'Task creation, status, and management')
    .addTag('Agent Runtime', 'Execute tasks, approve/reject, view traces')
    .addTag('Observability', 'Traces, spans, metrics, evaluations, and leaderboard')
    .addTag('Memory', 'Agent memory read/write and conflict detection')
    .addTag('Context', 'Business context notes CRUD')
    .addTag('Connectors', 'External service integrations (MCP)')
    .addTag('Approvals', 'Tier 3 approval queue management')
    .addTag('Events', 'Redis pub/sub event bus')
    .addTag('Activity', 'Agent activity feed')
    .addTag('Onboarding', 'Founder onboarding flow')
    .addTag('Health', 'Service health and readiness checks')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  
  logger.log(`Helm backend running on port ${port}`);
  logger.log(`API documentation available at http://localhost:${port}/api/docs`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
