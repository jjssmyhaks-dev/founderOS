import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
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
  FAST: 'llama3-8b-8192',
  DEFAULT: 'llama3-70b-8192',
  POWERFUL: 'llama3-70b-8192',
} as const;

const GROQ_MODELS = [
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma-7b-it',
] as const;

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);
  private client: Groq | null = null;
  private provider = 'groq';
  private defaultModel = MODEL_TIERS.DEFAULT;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    // Try Groq first (free tier)
    const groqKey = this.configService.get<string>('GROQ_API_KEY');
    if (groqKey) {
      this.client = new Groq({ apiKey: groqKey });
      this.provider = 'groq';
      this.logger.log('Groq client initialized');
      return;
    }

    // Fallback to Anthropic for production
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.provider = 'anthropic';
      this.logger.log('Anthropic client initialized (messages API)');
      return;
    }

    this.logger.warn('No LLM API key configured - LLM calls will fail');
  }

  async complete(options: LlmCompleteOptions): Promise<string> {
    if (this.provider === 'groq') return this.groqComplete(options);
    return this.anthropicComplete(options);
  }

  async chat(messages: Array<{ role: string; content: string }>, system?: string, model?: string, maxTokens?: number): Promise<string> {
    if (this.provider === 'groq') return this.groqChat(messages, system, model, maxTokens);
    return this.anthropicChat(messages, system, model, maxTokens);
  }

  private sanitizeModel(model?: string): string {
    if (model && (GROQ_MODELS as readonly string[]).includes(model)) return model;
    return this.defaultModel;
  }

  // Reasoning models (like qwen3.6) emit <think>...</think> blocks — strip them
  private stripThinking(text: string): string {
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  // ---- Groq implementation ----

  private async groqComplete(options: LlmCompleteOptions): Promise<string> {
    if (!this.client) throw new Error('Groq client not initialized. Set GROQ_API_KEY in .env');
    const model = this.sanitizeModel(options.model);
    const maxTokens = options.maxTokens || 2048;
    try {
      const messages: Groq.Chat.ChatCompletionMessageParam[] = [];
      if (options.system) messages.push({ role: 'system', content: options.system });
      messages.push({ role: 'user', content: options.prompt });

      const response = await this.retry(() =>
        this.client!.chat.completions.create({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
        3,
      );
      return this.stripThinking(response.choices[0]?.message?.content || '');
    } catch (err) {
      this.logger.error('Groq complete failed: ' + (err instanceof Error ? err.message : String(err)));
      throw err;
    }
  }

  private async groqChat(messages: Array<{ role: string; content: string }>, system?: string, model?: string, maxTokens?: number): Promise<string> {
    if (!this.client) throw new Error('Groq client not initialized. Set GROQ_API_KEY in .env');
    const resolvedModel = this.sanitizeModel(model);
    try {
      const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [];
      if (system) groqMessages.push({ role: 'system', content: system });
      for (const m of messages) {
        if (m.role === 'user' || m.role === 'assistant' || m.role === 'system') {
          groqMessages.push({ role: m.role as 'user' | 'assistant' | 'system', content: m.content });
        }
      }

      const response = await this.retry(() =>
        this.client!.chat.completions.create({
          model: resolvedModel,
          messages: groqMessages,
          max_tokens: maxTokens || 4096,
          temperature: 0.7,
        }),
        3,
      );
      return this.stripThinking(response.choices[0]?.message?.content || '');
    } catch (err) {
      this.logger.error('Groq chat failed: ' + (err instanceof Error ? err.message : String(err)));
      throw err;
    }
  }

  // ---- Anthropic implementation (kept for production switch) ----

  private async anthropicComplete(options: LlmCompleteOptions): Promise<string> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('Anthropic client not initialized. Set ANTHROPIC_API_KEY in .env');
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    const model = options.model || 'claude-sonnet-4-20250514';
    const maxTokens = options.maxTokens || 2048;
    try {
      const response: any = await this.retry(() =>
        (client as any).messages.create({
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
      this.logger.error('Anthropic complete failed: ' + (err instanceof Error ? err.message : String(err)));
      throw err;
    }
  }

  private async anthropicChat(messages: Array<{ role: string; content: string }>, system?: string, model?: string, maxTokens?: number): Promise<string> {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('Anthropic client not initialized. Set ANTHROPIC_API_KEY in .env');
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });
    try {
      const response: any = await this.retry(() =>
        (client as any).messages.create({
          model: model || 'claude-sonnet-4-20250514',
          max_tokens: maxTokens || 4096,
          system: system || undefined,
          messages: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        }),
        3,
      );
      const textBlock = response.content?.find((b: any) => b.type === 'text');
      return textBlock ? (textBlock as any).text : '';
    } catch (err) {
      this.logger.error('Anthropic chat failed: ' + (err instanceof Error ? err.message : String(err)));
      throw err;
    }
  }

  // ---- Shared utilities ----

  async classifyIntent(message: string, categories: string[]): Promise<LlmClassificationResult> {
    const system = 'Classify into ONE of: ' + categories.join(', ') + '. Respond JSON only: {"category":"...","confidence":0.0-1.0,"metadata":{}}';
    const raw = await this.complete({ prompt: 'Classify: "' + message + '"', system, maxTokens: 256 });
    try { return JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim()); }
    catch { return { category: categories[0] || 'UNKNOWN', confidence: 0.3 }; }
  }

  async generateEmbedding(text: string): Promise<string> {
    const id = uuidv4();
    this.logger.verbose('Generated embedding stub ' + id + ' for text (' + text.length + ' chars)');
    return id;
  }

  getModelTier(tier: string): string {
    return (MODEL_TIERS as any)[tier] || this.defaultModel;
  }

  getProvider(): string {
    return this.provider;
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
        const msg = lastError.message.toLowerCase();
        if (msg.includes('rate_limit') || msg.includes('overloaded') || msg.includes('429') || msg.includes('503')) continue;
        throw lastError;
      }
    }
    throw lastError;
  }
}
