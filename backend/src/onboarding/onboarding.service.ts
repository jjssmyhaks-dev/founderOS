import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MemoryService } from '../memory/memory.service';
import { LlmService } from '../llm/llm.service';

export interface OnboardingState {
  founderId: string;
  isOnboarding: boolean;
  questionCount: number;
  maxQuestions: number;
  capturedTopics: string[];
  firstActionProposed: boolean;
  firstActionCompleted: boolean;
}

const MAX_ONBOARDING_QUESTIONS = 5;

const ONBOARDING_SYSTEM_PROMPT = `You are Helm, an AI operating system for solo founders. This is your first conversation with a new founder.

Your goals for this conversation:
1. Introduce yourself briefly and directly - what you do, in plain language, no hype
2. Ask ONE open question about their business (what it does, what takes the most time right now)
3. Based on their answer, ask 2-3 more targeted follow-up questions (max 5 total questions)
4. After understanding their business, propose ONE small, concrete, low-risk action you can take right now

Rules:
- This is a conversation, not a form. Ask naturally, one question at a time.
- Adapt your follow-ups based on what the founder says
- Never ask more than 5 questions total
- Never propose anything that requires approval (Tier 3) as the first action
- When proposing the first action, make it real and specific (not a plan, an actual action)
- Keep responses concise and direct
- Do NOT explain what you are doing or mention "onboarding" - just have a natural conversation

IMPORTANT: After enough context or 5 questions, propose a specific action. Frame it as: "Here is something I can do right now for you..." and wait for their go-ahead.`;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private readonly states = new Map<string, OnboardingState>();

  constructor(
    private prisma: PrismaService,
    private memory: MemoryService,
    private llm: LlmService,
  ) {}

  async getFounderInfo(founderId: string) {
    const founder = await this.prisma.founder.findUnique({
      where: { id: founderId },
      select: { id: true, name: true, businessName: true, email: true, timezone: true, onboardingComplete: true },
    });
    return founder;
  }

  async isOnboardingComplete(founderId: string): Promise<boolean> {
    // Check DB first (persistent across restarts)
    const founder = await this.prisma.founder.findUnique({
      where: { id: founderId },
      select: { onboardingComplete: true },
    });
    if (founder?.onboardingComplete) return true;

    // Check in-memory state
    const state = this.states.get(founderId);
    return !state?.isOnboarding || state.firstActionCompleted;
  }

  async getOnboardingState(founderId: string): Promise<OnboardingState> {
    if (!this.states.has(founderId)) {
      this.states.set(founderId, {
        founderId,
        isOnboarding: true,
        questionCount: 0,
        maxQuestions: MAX_ONBOARDING_QUESTIONS,
        capturedTopics: [],
        firstActionProposed: false,
        firstActionCompleted: false,
      });
    }
    return this.states.get(founderId)!;
  }

  async handleOnboardingMessage(founderId: string, message: string): Promise<{ response: string; isOnboarding: boolean }> {
    const state = await this.getOnboardingState(founderId);

    // Question 1: first response
    if (state.questionCount === 0) {
      state.questionCount = 1;
      this.states.set(founderId, state);

      const response = await this.llm.complete({
        prompt: `${message}

Respond naturally as if this is the start of a conversation. Ask ONE follow-up question about their business.`,
        system: ONBOARDING_SYSTEM_PROMPT,
        maxTokens: 512,
      });
      return { response, isOnboarding: true };
    }

    state.questionCount++;

    // Max questions reached -> propose first action
    if (state.questionCount >= state.maxQuestions && !state.firstActionProposed) {
      state.firstActionProposed = true;
      this.states.set(founderId, state);
      await this.extractAndSaveContext(founderId, message);
      const action = await this.proposeFirstAction(founderId);
      return { response: action, isOnboarding: true };
    }

    // Founder responded to action proposal
    if (state.firstActionProposed && !state.firstActionCompleted) {
      const lower = message.toLowerCase();
      const isAffirmative = ['yes', 'sure', 'go', 'do it', 'ok', 'yeah', 'please', 'please do', 'go ahead', 'let\'s do it', 'absolutely', 'definitely'].some(w => lower.includes(w));

      if (isAffirmative) {
        state.firstActionCompleted = true;
        state.isOnboarding = false;
        this.states.set(founderId, state);

        // Persist to DB
        await this.prisma.founder.update({
          where: { id: founderId },
          data: { onboardingComplete: true },
        });

        return {
          response: 'Great, I\'m on it. While that runs, feel free to ask me anything or give me tasks. I\'ll keep learning about your business as we work together.',
          isOnboarding: false,
        };
      }

      // Not affirmative - either decline or off-topic
      if (['no', 'nope', 'not yet', 'later', 'skip', 'decline'].some(w => lower.includes(w))) {
        // They declined - mark onboarding done anyway, they can come back
        state.firstActionCompleted = true;
        state.isOnboarding = false;
        this.states.set(founderId, state);
        await this.prisma.founder.update({
          where: { id: founderId },
          data: { onboardingComplete: true },
        });
        return {
          response: 'No problem. You can always ask me to do things later. What would you like to work on?',
          isOnboarding: false,
        };
      }

      // Off-topic or question about the proposal
      const response = await this.llm.complete({
        prompt: `${message}

The founder responded to your action proposal but didn\'t clearly say yes or no. Address their question, then ask again if they want you to go ahead. Keep it brief.`,
        system: ONBOARDING_SYSTEM_PROMPT,
        maxTokens: 512,
      });
      return { response, isOnboarding: true };
    }

    // Normal follow-up questions
    const remaining = state.maxQuestions - state.questionCount;
    const response = await this.llm.complete({
      prompt: `${message}

Ask ONE follow-up question. You have asked ${state.questionCount - 1} questions so far and have ${remaining} more available. Make it count.`,
      system: ONBOARDING_SYSTEM_PROMPT,
      maxTokens: 512,
    });

    if (message.length > 10) {
      state.capturedTopics.push(message.substring(0, 100));
      this.states.set(founderId, state);
    }

    return { response, isOnboarding: true };
  }

  async handleOpeningMessage(founderId: string, founderName: string, businessName: string): Promise<string> {
    const biz = businessName || '(not yet provided)';
    const prompt = `The founder named ${founderName} just signed up. Their business is called ${biz}. Send a short, direct opening message. Introduce yourself, state what you do in one sentence, and ask what the business does and what takes the most time right now. Be conversational, not corporate.`;

    const response = await this.llm.complete({ prompt, system: ONBOARDING_SYSTEM_PROMPT, maxTokens: 512 });
    await this.getOnboardingState(founderId);

    if (businessName) {
      await this.memory.writeMemory({
        founderId,
        memoryType: 'business_fact',
        content: `Business name: ${businessName}`,
        confidence: 'founder_stated',
      });
    }

    return response;
  }

  async markOnboardingComplete(founderId: string) {
    const state = this.states.get(founderId);
    if (state) {
      state.isOnboarding = false;
      state.firstActionCompleted = true;
      this.states.set(founderId, state);
    }
    // Always persist to DB
    await this.prisma.founder.update({
      where: { id: founderId },
      data: { onboardingComplete: true },
    });
    this.logger.log(`Onboarding marked complete for founder ${founderId}`);
  }

  private async extractAndSaveContext(founderId: string, lastMessage: string) {
    const state = this.states.get(founderId);
    if (!state) return;

    const conversationSummary = state.capturedTopics.join('\n');
    if (!conversationSummary) return;

    try {
      const extraction = await this.llm.complete({
        prompt: `Extract business facts from this conversation. Return a JSON array of objects with "type" (business_fact, strategic_goal, or constraint) and "content" fields.\n\nConversation:\n${conversationSummary}\n\nLast message: ${lastMessage}`,
        system: 'Extract structured business context. Return JSON array only.',
        maxTokens: 1024,
      });

      const jsonMatch = extraction.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const facts: Array<{ type: string; content: string }> = JSON.parse(jsonMatch[0]);
        for (const fact of facts.slice(0, 5)) {
          await this.memory.writeMemory({
            founderId,
            memoryType: (fact.type as any) || 'business_fact',
            content: fact.content,
            confidence: 'inferred',
          });
        }
        this.logger.log(`Extracted ${Math.min(facts.length, 5)} business facts from onboarding`);
      }
    } catch (e) {
      this.logger.warn('Failed to extract context from onboarding: ' + String(e));
    }
  }

  private async proposeFirstAction(founderId: string): Promise<string> {
    const state = this.states.get(founderId);
    const context = state ? state.capturedTopics.join('\n') : '';
    const contextBlock = context ? `\n\nWhat you know:\n${context}` : '';

    const prompt = `Based on what you know about this founder, propose ONE small, concrete, low-risk action you can take right now. It must be Tier 1 or Tier 2 only (no approval needed). Be specific about what you will do and what they will get. End by asking if they want you to go ahead.${contextBlock}`;

    return this.llm.complete({ prompt, system: ONBOARDING_SYSTEM_PROMPT, maxTokens: 512 });
  }
}
