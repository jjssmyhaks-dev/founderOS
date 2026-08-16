import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AgentService } from '../agents/agents.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { AuthSecurityService } from '../common/services/auth-security.service';
import { SignupDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private agentService: AgentService,
    private onboarding: OnboardingService,
    private security: AuthSecurityService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.founder.findUnique({ where: { email: dto.email } });
    if (existing) throw new Error('Email already registered');

    const hash = await bcrypt.hash(dto.password, 12);
    const founder = await this.prisma.founder.create({
      data: {
        email: dto.email,
        name: dto.name,
        businessName: dto.businessName || null,
        passwordHash: hash,
        timezone: dto.timezone || 'UTC',
        autonomySettings: {
          research: { defaultTier: 'NOTIFY_AND_ACT' },
          marketing: { defaultTier: 'NOTIFY_AND_ACT' },
          operations: { defaultTier: 'NOTIFY_AND_ACT' },
          finance: { defaultTier: 'APPROVAL_REQUIRED' },
        },
      },
    });

    const token = this.jwt.sign({
      sub: founder.id,
      email: founder.email,
      businessName: founder.businessName,
    });

    this.agentService.seedAgents(founder.id).catch((e) =>
      this.logger.error('Agent seed failed: ' + String(e)),
    );

    return { access_token: token, founder: this.sanitize(founder), needsOnboarding: true };
  }

  async login(dto: LoginDto, req?: Request) {
    const founder = await this.prisma.founder.findUnique({ where: { email: dto.email } });
    if (!founder || !founder.passwordHash) {
      const ip = (req as any)?.ip || (req as any)?.connection?.remoteAddress;
      const ua = (req as any)?.headers?.['user-agent'];
      await this.security.logFailedLogin(dto.email, ip, ua);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, founder.passwordHash);
    if (!valid) {
      const ip = (req as any)?.ip || (req as any)?.connection?.remoteAddress;
      const ua = (req as any)?.headers?.['user-agent'];
      const { isPotentialBruteForce } = await this.security.logFailedLogin(dto.email, ip, ua);
      if (isPotentialBruteForce) {
        throw new UnauthorizedException('Too many failed attempts. Try again later.');
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwt.sign({ sub: founder.id, email: founder.email });
    const onboardingDone = await this.onboarding.isOnboardingComplete(founder.id);

    return { access_token: token, founder: this.sanitize(founder), needsOnboarding: !onboardingDone };
  }

  async getProfile(founderId: string) {
    const founder = await this.prisma.founder.findUnique({ where: { id: founderId } });
    if (!founder) throw new Error('Founder not found');
    return this.sanitize(founder);
  }

  async updateAutonomySettings(founderId: string, settings: any) {
    const founder = await this.prisma.founder.update({
      where: { id: founderId },
      data: { autonomySettings: settings },
    });
    return this.sanitize(founder);
  }

  private sanitize(f: any) {
    const { passwordHash, ...rest } = f;
    return rest;
  }
}
