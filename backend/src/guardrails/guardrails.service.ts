import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventService } from '../events/events.service';
import { LlmService } from '../llm/llm.service';
import { v4 } from 'uuid';

export interface GuardrailCheckResult {
  allowed: boolean;
  sanitized?: string;
  blocked?: boolean;
  reason?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'BLOCKED';
  auditType: string;
}

interface BudgetState {
  tokensUsed: number;
  tasksCompleted: number;
  costCentsUsed: number;
}

// Known prompt injection patterns
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+(a|an|the)/i,
  /new\s+(role|instructions?|system)\s*:/i,
  /act\s+as\s+if\s+you\s+(have\s+no|don.t|do\s+not)\s+(have\s+)?(restrictions?|rules?|limits?)/i,
  /forget\s+(everything|all|your)\s+(previous|prior|above)/i,
  /disregard\s+(all|any|previous)\s+(instructions?|rules?)/i,
  /\bDAN\b.*\bjailbreak/i,
  /\b jailbreak\b/i,
  /output\s+(the|your)\s+(system|full)\s+(prompt|instructions?)/i,
  /what\s+(is|are)\s+your\s+(system|initial)\s+(prompt|instructions?)/i,
  /repeat\s+(everything|all|the)\s+(above|before|from)/i,
  /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/i,
  /human\s*:\s*|assistant\s*:\s*/i,
];

// PII patterns
const PII_PATTERNS = [
  { name: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'PHONE', regex: /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g },
  { name: 'SSN', regex: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g },
  { name: 'CREDIT_CARD', regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g },
  { name: 'AADHAAR', regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g },
  { name: 'PAN', regex: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
];

// Sensitive output patterns (should never be in agent output)
const SENSITIVE_OUTPUT_PATTERNS = [
  /password\s*[:=]\s*\S+/i,
  /secret\s*[:=]\s*\S+/i,
  /api[_-]?key\s*[:=]\s*\S+/i,
  /token\s*[:=]\s*\S+/i,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i,
];

@Injectable()
export class GuardrailsService implements OnModuleInit {
  private readonly logger = new Logger(GuardrailsService.name);
  // In-memory rate limiter: {founderId:agentId: [timestamps]}
  private rateLimitMap = new Map<string, number[]>();
  // Budget cache
  private budgetCache = new Map<string, BudgetState>();

  constructor(
    private prisma: PrismaService,
    private events: EventService,
    private llm: LlmService,
  ) {}

  onModuleInit() {
    // Clean rate limiter every 5 minutes
    setInterval(() => this.cleanRateLimiter(), 300000);
    this.logger.log('GuardrailsService initialized');
  }

  // ─── Input Guardrails ─────────────────────────────────────────────────

  async checkInput(input: string, agentId: string, founderId: string, taskId?: string): Promise<GuardrailCheckResult> {
    // 1. Prompt injection detection
    const injectionCheck = this.detectPromptInjection(input);
    if (injectionCheck.blocked) {
      await this.audit(founderId, agentId, taskId, 'PROMPT_INJECTION', 'BLOCKED', input, undefined, injectionCheck.reason!);
      return { allowed: false, blocked: true, severity: 'BLOCKED', auditType: 'PROMPT_INJECTION', reason: injectionCheck.reason };
    }

    // 2. Input length check (prevent abuse)
    if (input.length > 50000) {
      await this.audit(founderId, agentId, taskId, 'INPUT_TOO_LONG', 'WARNING', input, undefined, 'Input exceeds 50k chars');
      return { allowed: true, severity: 'WARNING', auditType: 'INPUT_TOO_LONG', reason: 'Input truncated' };
    }

    // 3. Rate limiting (per agent per founder)
    const rateLimit = this.checkRateLimit(founderId, agentId, 30, 60000); // 30 req/min
    if (!rateLimit.allowed) {
      await this.audit(founderId, agentId, taskId, 'RATE_LIMITED', 'WARNING', input, undefined, 'Rate limit exceeded');
      return { allowed: false, severity: 'WARNING', auditType: 'RATE_LIMITED', reason: rateLimit.reason };
    }

    // 4. PII detection and redaction
    const { sanitized, piiFound } = this.detectAndRedactPII(input);
    if (piiFound) {
      await this.audit(founderId, agentId, taskId, 'PII_DETECTED', 'INFO', input, sanitized, 'PII found and redacted');
    }

    return { allowed: true, sanitized: sanitized || input, severity: 'INFO', auditType: 'PASSED' };
  }

  // ─── Output Guardrails ────────────────────────────────────────────────

  async checkOutput(output: string, agentId: string, founderId: string, taskId?: string): Promise<GuardrailCheckResult> {
    // 1. Sensitive data leakage detection
    const sensitiveCheck = this.detectSensitiveOutput(output);
    if (sensitiveCheck.length > 0) {
      const sanitized = this.sanitizeSensitiveOutput(output);
      await this.audit(founderId, agentId, taskId, 'SENSITIVE_OUTPUT', 'CRITICAL', undefined, output, 'Sensitive data in output: ' + sensitiveCheck.join(', '));
      return { allowed: true, sanitized, severity: 'CRITICAL', auditType: 'SENSITIVE_OUTPUT', reason: 'Output contained sensitive data' };
    }

    // 2. Output length check
    if (output.length > 100000) {
      return { allowed: true, sanitized: output.substring(0, 100000) + '...', severity: 'WARNING', auditType: 'OUTPUT_TRUNCATED', reason: 'Output truncated to 100k chars' };
    }

    return { allowed: true, severity: 'INFO', auditType: 'PASSED' };
  }

  // ─── Budget Enforcement ───────────────────────────────────────────────

  async checkBudget(agentId: string, founderId: string, estimatedTokens: number = 0): Promise<GuardrailCheckResult> {
    const budget = await this.getOrCreateBudget(founderId, agentId);

    // Check task limit
    if (budget.tasksCompleted >= budget.taskLimit) {
      await this.audit(founderId, agentId, undefined, 'BUDGET_EXCEEDED', 'CRITICAL', undefined, undefined, `Task limit reached: ${budget.tasksCompleted}/${budget.taskLimit}`);
      return { allowed: false, severity: 'CRITICAL', auditType: 'BUDGET_EXCEEDED', reason: `Daily task limit reached (${budget.taskLimit})` };
    }

    // Check token limit
    if (budget.tokensUsed + estimatedTokens > budget.tokenLimit) {
      await this.audit(founderId, agentId, undefined, 'BUDGET_EXCEEDED', 'WARNING', undefined, undefined, `Token limit approaching: ${budget.tokensUsed}/${budget.tokenLimit}`);
      return { allowed: false, severity: 'WARNING', auditType: 'BUDGET_EXCEEDED', reason: `Token budget exceeded (${budget.tokenLimit})` };
    }

    // Check cost limit
    if (budget.costCentsUsed >= budget.costLimitCents) {
      await this.audit(founderId, agentId, undefined, 'BUDGET_EXCEEDED', 'CRITICAL', undefined, undefined, `Cost limit reached: $${budget.costCentsUsed / 100}`);
      return { allowed: false, severity: 'CRITICAL', auditType: 'BUDGET_EXCEEDED', reason: `Cost limit exceeded ($${budget.costLimitCents / 100})` };
    }

    return { allowed: true, severity: 'INFO', auditType: 'BUDGET_OK' };
  }

  async recordUsage(agentId: string, founderId: string, tokens: number, costCents: number): Promise<void> {
    const budget = await this.getOrCreateBudget(founderId, agentId);
    await this.prisma.agentBudget.update({
      where: { id: budget.id },
      data: {
        tokensUsed: { increment: tokens },
        costCentsUsed: { increment: costCents },
        tasksCompleted: { increment: 1 },
      },
    });
    // Update cache
    const key = founderId + ':' + agentId;
    const cached = this.budgetCache.get(key);
    if (cached) {
      cached.tokensUsed += tokens;
      cached.costCentsUsed += costCents;
      cached.tasksCompleted += 1;
    }
  }

  // ─── Prompt Injection Detection ───────────────────────────────────────

  private detectPromptInjection(input: string): { blocked: boolean; reason?: string } {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        this.logger.warn('Prompt injection detected: ' + pattern.source.substring(0, 50));
        return { blocked: true, reason: 'Potential prompt injection detected' };
      }
    }

    // Check for excessive system-role-like content
    const systemMarkers = (input.match(/system\s*:/gi) || []).length;
    if (systemMarkers > 3) {
      return { blocked: true, reason: 'Excessive system-role markers in input' };
    }

    return { blocked: false };
  }

  // ─── PII Detection & Redaction ────────────────────────────────────────

  private detectAndRedactPII(input: string): { sanitized: string; piiFound: boolean } {
    let sanitized = input;
    let piiFound = false;

    for (const pii of PII_PATTERNS) {
      if (pii.regex.test(input)) {
        piiFound = true;
        sanitized = sanitized.replace(pii.regex, `[REDACTED_${pii.name}]`);
        // Reset regex lastIndex since we're using global flag
        pii.regex.lastIndex = 0;
      }
    }

    return { sanitized, piiFound };
  }

  // ─── Sensitive Output Detection ───────────────────────────────────────

  private detectSensitiveOutput(output: string): string[] {
    const found: string[] = [];
    for (const pattern of SENSITIVE_OUTPUT_PATTERNS) {
      if (pattern.test(output)) {
        found.push(pattern.source.substring(0, 30));
      }
    }
    return found;
  }

  private sanitizeSensitiveOutput(output: string): string {
    let sanitized = output;
    for (const pattern of SENSITIVE_OUTPUT_PATTERNS) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    return sanitized;
  }

  // ─── Rate Limiting ────────────────────────────────────────────────────

  private checkRateLimit(founderId: string, agentId: string, maxRequests: number, windowMs: number): { allowed: boolean; reason?: string } {
    const key = founderId + ':' + agentId;
    const now = Date.now();
    const timestamps = this.rateLimitMap.get(key) || [];

    // Remove expired entries
    const valid = timestamps.filter(t => now - t < windowMs);

    if (valid.length >= maxRequests) {
      return { allowed: false, reason: `Rate limit: ${maxRequests} requests per ${windowMs / 1000}s` };
    }

    valid.push(now);
    this.rateLimitMap.set(key, valid);
    return { allowed: true };
  }

  private cleanRateLimiter() {
    const cutoff = Date.now() - 120000; // 2 minutes
    for (const [key, timestamps] of this.rateLimitMap) {
      const valid = timestamps.filter(t => t > cutoff);
      if (valid.length === 0) this.rateLimitMap.delete(key);
      else this.rateLimitMap.set(key, valid);
    }
  }

  // ─── Budget Management ────────────────────────────────────────────────

  private async getOrCreateBudget(founderId: string, agentId: string): Promise<any> {
    const key = founderId + ':' + agentId;
    const cached = this.budgetCache.get(key);
    if (cached && cached.tokensUsed < cached.tokensUsed + 1) {
      // Return from cache if exists
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let budget = await this.prisma.agentBudget.findFirst({
      where: { founderId, agentId, period: 'daily', periodStart: { gte: today } },
    });

    if (!budget) {
      budget = await this.prisma.agentBudget.create({
        data: {
          founderId, agentId, period: 'daily',
          tokenLimit: 100000, taskLimit: 50, costLimitCents: 500,
          periodStart: today,
        },
      });
    }

    this.budgetCache.set(key, { tokensUsed: budget.tokensUsed, tasksCompleted: budget.tasksCompleted, costCentsUsed: budget.costCentsUsed });
    return budget;
  }

  // ─── Audit Logging ────────────────────────────────────────────────────

  private async audit(
    founderId: string, agentId: string, taskId: string | undefined,
    auditType: string, severity: string,
    input: string | undefined, output: string | undefined,
    details: string,
  ): Promise<void> {
    try {
      await this.prisma.guardrailAudit.create({
        data: {
          founderId, agentId, taskId: taskId || null,
          auditType, severity,
          details: { reason: details } as any,
          input: input?.substring(0, 2000) || null,
          output: output?.substring(0, 2000) || null,
          action: severity === 'BLOCKED' ? 'blocked' : severity === 'CRITICAL' ? 'sanitized' : 'logged',
        },
      });

      // Publish event for critical/blocked events
      if (severity === 'CRITICAL' || severity === 'BLOCKED') {
        await this.events.publish({
          type: 'guardrail.alert', publisher: 'guardrails',
          payload: { agentId, founderId, auditType, severity, details } as any,
          founderId,
        });
      }
    } catch (e) {
      this.logger.warn('Audit log failed: ' + String(e));
    }
  }

  // ─── Query API ────────────────────────────────────────────────────────

  async getAuditLog(founderId: string, options?: { agentId?: string; auditType?: string; limit?: number }) {
    const where: any = { founderId };
    if (options?.agentId) where.agentId = options.agentId;
    if (options?.auditType) where.auditType = options.auditType;
    return this.prisma.guardrailAudit.findMany({
      where, orderBy: { createdAt: 'desc' }, take: options?.limit || 50,
    });
  }

  async getBudgetStatus(founderId: string, agentId?: string) {
    const where: any = { founderId, period: 'daily' };
    if (agentId) where.agentId = agentId;
    return this.prisma.agentBudget.findMany({ where });
  }

  async getGuardrailStats(founderId: string, days: number = 7) {
    const since = new Date(Date.now() - days * 86400000);
    const audits = await this.prisma.guardrailAudit.groupBy({
      by: ['auditType', 'severity'],
      where: { founderId, createdAt: { gte: since } },
      _count: true,
    });
    return audits;
  }
}
