import { Injectable, NestMiddleware, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();

  private readonly windowMs = 60 * 1000; // 1 minute
  private readonly maxRequests = 60; // per minute per IP
  private readonly authMaxRequests = 5; // stricter for auth endpoints

  use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const path = req.path;
    const now = Date.now();

    const isAuth = path.startsWith('/auth/signup') || path.startsWith('/auth/login');
    const maxReq = isAuth ? this.authMaxRequests : this.maxRequests;

    let record = this.attempts.get(ip);
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + this.windowMs };
      this.attempts.set(ip, record);
    }

    record.count++;

    res.setHeader('X-RateLimit-Limit', String(maxReq));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxReq - record.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

    if (record.count > maxReq) {
      this.logger.warn(`Rate limit exceeded for ${ip} on ${path}`);
      throw new HttpException(
        { statusCode: 429, error: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded. Try again later.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}
