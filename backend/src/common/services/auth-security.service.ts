import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface SecurityLog {
  id: string;
  type: 'auth.login_failed' | 'auth.token_invalid' | 'auth.rls_violation' | 'auth.approval_mismatch' | 'auth.elevated_access';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  founderId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: string;
  timestamp: Date;
}

@Injectable()
export class AuthSecurityService {
  private readonly logger = new Logger(AuthSecurityService.name);

  constructor(private prisma: PrismaService) {}

  async logSecurityEvent(event: Omit<SecurityLog, 'id' | 'timestamp'>) {
    const record = { ...event, timestamp: new Date() };

    const logFn = event.severity === 'HIGH' ? 'error' : event.severity === 'MEDIUM' ? 'warn' : 'log';
    this.logger[logFn](`[SECURITY] ${event.type}: ${event.details}` + (event.founderId ? ` (founder=${event.founderId})` : ''));

    try {
      await this.prisma.activityLog.create({
        data: {
          founderId: event.founderId || '00000000-0000-0000-0000-000000000000',
          type: 'SECURITY_EVENT',
          description: `[${event.type}] ${event.details}`,
          metadata: {
            securityType: event.type,
            severity: event.severity,
            ipAddress: event.ipAddress,
          },
        },
      });
    } catch (e) {
      this.logger.error('Failed to persist security log: ' + String(e));
    }

    if (event.severity === 'HIGH') {
      try {
        await this.prisma.event.create({
          data: {
            type: 'security.' + event.type,
            publisher: 'auth-system',
            payload: { ...record, alertSeverity: 'HIGH' } as any,
            timestamp: new Date(),
          },
        });
      } catch (e) {
        this.logger.error('Failed to publish security event: ' + String(e));
      }
    }
  }

  async logFailedLogin(email: string, ipAddress?: string, userAgent?: string) {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentFailures = await this.prisma.activityLog.count({
      where: {
        type: 'SECURITY_EVENT',
        description: { contains: email },
        timestamp: { gte: fifteenMinAgo },
      },
    });

    const severity = recentFailures >= 5 ? 'HIGH' : 'MEDIUM';
    await this.logSecurityEvent({
      type: 'auth.login_failed',
      severity,
      details: `Failed login attempt for ${email} (${recentFailures + 1} recent failures)`,
      ipAddress,
      userAgent,
    });

    return { isPotentialBruteForce: recentFailures >= 5, recentFailures: recentFailures + 1 };
  }

  async logApprovalMismatch(approvalId: string, expectedFounderId: string, actualFounderId: string, ipAddress?: string) {
    await this.logSecurityEvent({
      type: 'auth.approval_mismatch',
      severity: 'HIGH',
      founderId: actualFounderId,
      details: `Approval ${approvalId}: expected founder ${expectedFounderId}, got ${actualFounderId}. Possible authorization bypass attempt.`,
      ipAddress,
    });
  }
}
