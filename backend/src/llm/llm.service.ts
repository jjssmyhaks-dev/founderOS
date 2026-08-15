import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';

export interface LlmCompleteOptions {
  prompt: string;
  system?: string;
  maxTokens?: number;
  model?: string;
}

export interface LlmClassificationResult {
  category: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

const MODEL_TIERS = {
  FAST: 'claude-3-haiku-20240307',
  DEFAULT: 'claude-sonnet-4-20250514',
  POWERFUL: 'claude-opus-4-20250514',
} as const;

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);
  private client: Anthropic | null = null;
  private defaultModel = MODEL_TIERS.DEFAULT;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log('Anthropic client initialized (messages API)');
    } else {
      this.logger.warn('No ANTHROPIC_API_KEY configured - LLM calls will fail');
    }
  }

  async complete(options: LlmCompleteOptions): Promise<string> {
    if (!this.client) throw new Error('Anthropic client not initialized. Set ANTHROPIC_API_KEY in .env');
    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || 2048;
    try {
      const response: any = await this.retry(() =>
        (this.client as any).messages.create({
          model,
          max_tokens: maxTokens,
          system: options.system || undefined,
          messages: [{ role: 'user', content: options.prompt }],
        }),
        3,
      );
      const textBlock = response.content?.find((b: any) => b.type === 'text');
      return textBlock ? (textBlock as any).text : '';
    } catch (err) {
      this.logger.error('LLM failed: ' + (err instanceof Error ? err.message : String(err)));
      throw err;
    }
  }

  async chat(messages: Array<{ role: string; content: string }>, system?: string, model?: string, maxTokens?: number): Promise<string> {
    if (!this.client) throw new Error('Anthropic client not initialized. Set ANTHROPIC_API_KEY in .env');
    try {
      const response: any = await this.retry(() =>
        (this.client as any).messages.create({
          model: model || this.defaultModel,
          max_tokens: maxTokens || 4096,
          system: system || undefined,
          messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        }),
        3,
      );
      const textBlock = response.content?.find((b: any) => b.type === 'text');
      return textBlock ? (textBlock as any).text : '';
    } catch (err) {
      this.logger.error('LLM chat failed: ' + (err instanceof Error ? err.message : String(err)));
      throw err;
    }
  }

  async classifyIntent(message: string, categories: string[]): Promise<LlmClassificationResult> {
    const system = 'Classify into ONE of: ' + categories.join(', ') + '. Respond JSON only: {"category":"...","confidence":0.0-1.0,"metadata":{}}';
    const raw = await this.complete({ prompt: 'Classify: "' + message + '"', system, maxTokens: 256 });
    try { return JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim()); }
    catch { return { category: categories[0] || 'UNKNOWN', confidence: 0.3 }; }
  }

  async generateEmbedding(text: string): Promise<string> {
    // TODO: Replace with real embedding API (OpenAI embeddings, Voyage AI, etc.)
    // For now, return a UUID stub — pgvector search will use LLM-based ranking fallback
    const id = uuidv4();
    this.logger.verbose('Generated embedding stub ' + id + ' for text (' + text.length + ' chars)');
    return id;
  }

  getModelTier(tier: string): string {
    return (MODEL_TIERS as any)[tier] || this.defaultModel;
  }

  private async retry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
    let lastError: Error | undefined;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        if (i > 0) { const delay = Math.pow(2, i) * 500; await new Promise(r => setTimeout(r, delay)); }
        return await fn();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (i === maxRetries) break;
        if (lastError.message.includes('rate_limit') || lastError.message.includes('overloaded')) continue;
        throw lastError;
      }
    }
    throw lastError;
  }
}
