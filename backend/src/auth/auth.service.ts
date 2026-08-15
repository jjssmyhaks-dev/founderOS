import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.founder.findUnique({ where: { email: dto.email } });
    if (existing) throw new Error('Email already registered');

    const hash = await bcrypt.hash(dto.password, 12);
    const founder = await this.prisma.founder.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: hash,
        timezone: 'Asia/Calcutta',
        autonomySettings: {
          research: { defaultTier: 'NOTIFY_AND_ACT' },
          marketing: { defaultTier: 'NOTIFY_AND_ACT' },
          operations: { defaultTier: 'NOTIFY_AND_ACT' },
          finance: { defaultTier: 'APPROVAL_REQUIRED' },
        },
      },
    });

    const token = this.jwt.sign({ sub: founder.id, email: founder.email });
    return { access_token: token, founder: this.sanitize(founder) };
  }

  async login(dto: LoginDto) {
    const founder = await this.prisma.founder.findUnique({ where: { email: dto.email } });
    if (!founder || !founder.passwordHash) throw new Error('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, founder.passwordHash);
    if (!valid) throw new Error('Invalid credentials');

    const token = this.jwt.sign({ sub: founder.id, email: founder.email });
    return { access_token: token, founder: this.sanitize(founder) };
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
