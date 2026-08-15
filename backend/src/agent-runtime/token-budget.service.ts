import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokenBudgetService {
  private readonly logger = new Logger(TokenBudgetService.name);
  // Rough estimate: ~4 chars per token for English text
  private static CHARS_PER_TOKEN = 4;

  constructor(private prisma: PrismaService) {}

  enforce(budgetTokens: number, parts: Array<{ content: string; priority: number }>): string[] {
    const budgetChars = budgetTokens * TokenBudgetService.CHARS_PER_TOKEN;
    let usedChars = 0;
    const result: string[] = [];

    // Sort by priority (lower = higher priority)
    const sorted = [...parts].sort((a, b) => a.priority - b.priority);

    for (const part of sorted) {
      const partLen = part.content.length;
      if (usedChars + partLen <= budgetChars) {
        result.push(part.content);
        usedChars += partLen;
      } else {
        const remaining = budgetChars - usedChars;
        if (remaining > 50) {
          result.push(part.content.substring(0, remaining - 3) + '...');
          usedChars += remaining;
        }
        break;
      }
    }

    this.logger.verbose('Token budget enforced: ' + Math.floor(usedChars / TokenBudgetService.CHARS_PER_TOKEN) + '/' + budgetTokens + ' tokens');
    return result;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / TokenBudgetService.CHARS_PER_TOKEN);
  }
}
