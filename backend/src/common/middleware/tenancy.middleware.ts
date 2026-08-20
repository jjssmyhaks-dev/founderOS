import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenancyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenancyMiddleware.name);

  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7);
    let founderId: string;

    try {
      const payload = this.jwt.verify(token);
      founderId = payload.sub;
    } catch (e) {
      this.logger.warn('Invalid JWT token in tenancy middleware');
      return next();
    }

    if (!founderId) {
      return next();
    }

    // Sanitize founderId to prevent SQL injection (should be UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(founderId)) {
      this.logger.warn(`Invalid founderId format: ${founderId}`);
      return next();
    }

    // Set the Postgres session variable for RLS using parameterized approach
    // Note: SET LOCAL doesn't support parameters, so we validate the UUID format first
    try {
      await this.prisma.$executeRawUnsafe(
        `SET LOCAL app.current_founder_id = $1`,
        founderId,
      );
    } catch (e) {
      this.logger.error('Failed to set RLS session variable: ' + String(e));
    }

    // Attach founderId to request for downstream use
    (req as any).founderId = founderId;

    next();
  }
}
