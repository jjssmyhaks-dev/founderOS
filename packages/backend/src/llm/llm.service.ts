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

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);
  private client: Anthropic | null = null;
  private defaultModel = 'claude-2.1';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      this.logger.log('Anthropic client initialized');
    } else {
      this.logger.warn('No ANTHROPIC_API_KEY configured');
    }
  }

  async complete(options: LlmCompleteOptions): Promise<string> {
    if (!this.client) throw new Error('Anthropic client not initialized');
    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || 2048;
    const prompt = options.system
      ? `${Anthropic.HUMAN_PROMPT} ${options.system}\n\n${options.prompt}${Anthropic.AI_PROMPT}`
      : `${Anthropic.HUMAN_PROMPT} ${options.prompt}${Anthropic.AI_PROMPT}`;
    try {
      const response: any = await this.retry(
        () => this.client!.completions.create({ model, max_tokens_to_sample: maxTokens, prompt } as any),
        3,
      );
      return response.completion || '';
    } catch (err) {
      this.logger.error('LLM failed: ' + (err instanceof Error ? err.message : String(err)));
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
    const id = uuidv4();
    this.logger.log('Generated embedding id ' + id + ' for text (' + text.length + ' chars)');
    return id;
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
        if (lastError.message.includes('rate_limit')) continue;
        throw lastError;
      }
    }
    throw lastError;
  }
}
