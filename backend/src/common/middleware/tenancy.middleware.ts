import { Injectable, NestMiddleware, Logger, UnauthorizedException } from '@nestjs/common';
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

    // Set the Postgres session variable for RLS
    try {
      await this.prisma.$executeRawUnsafe(
        `SET LOCAL app.current_founder_id = '${founderId}'`,
      );
    } catch (e) {
      this.logger.error('Failed to set RLS session variable: ' + String(e));
    }

    // Attach founderId to request for downstream use
    (req as any).founderId = founderId;

    next();
  }
}
