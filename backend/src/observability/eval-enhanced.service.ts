import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';
import { EventService } from '../events/events.service';
import { LlmService } from '../llm/llm.service';
import { v4 as uuidv4 } from 'uuid';
import { AgentConfig, MODEL_TIERS } from '../agent-runtime/types';

export interface EvalMetrics {
  accuracy: number;       // 0-100, how correct was the output
  relevance: number;      // 0-100, how relevant to the query
  completeness: number;   // 0-100, did it cover all aspects
  toolUsage: number;      // 0-100, did it use tools appropriately
  safety: number;         // 0-100, was the output safe and appropriate
  overall: number;        // Weighted average
}

export interface EvalResult {
  taskId: string;
  agentId: string;
  metrics: EvalMetrics;
  passed: boolean;
  feedback: string;
  suggestions: string[];
  durationMs: number;
}

@Injectable()
export class EvalEnhancedService {
  private readonly logger = new Logger(EvalEnhancedService.name);

  constructor(
    private prisma: PrismaService,
    private runtime: AgentRuntimeService,
    private events: EventService,
    private llm: LlmService,
  ) {}

  // ─── LLM-as-Judge Evaluation ──────────────────────────────────────────

  async evaluateTask(taskId: string): Promise<EvalResult> {
    const startTime = Date.now();
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('Task not found');

    const steps = await this.prisma.taskStep.findMany({ where: { taskId }, orderBy: { stepNumber: 'asc' } });
    const trace = task.traceId ? await this.prisma.trace.findUnique({ where: { id: task.traceId } }) : null;

    const output = task.result || '';
    const goal = task.goal || task.description || '';

    // Get agent prompt for context
    const agentDef = await this.prisma.agent.findFirst({ where: { id: task.agentId || '' } });

    // LLM-as-judge evaluation
    const metrics = await this.llmJudgeEval(goal, output, steps, agentDef);

    const passed = metrics.overall >= 60;
    const feedback = await this.generateFeedback(goal, output, metrics);
    const suggestions = await this.generateSuggestions(task.agentId || '', metrics, steps);

    const result: EvalResult = {
      taskId, agentId: task.agentId || '', metrics, passed, feedback, suggestions,
      durationMs: Date.now() - startTime,
    };

    // Store eval result
    await this.prisma.evalRun.create({
      data: {
        agentId: task.agentId || 'unknown',
        testSetVersion: 'live',
        totalTests: 1,
        passedTests: passed ? 1 : 0,
        failedTests: passed ? 0 : 1,
        score: metrics.overall,
        passed,
        triggeredBy: 'auto',
      },
    });

    // Publish event if regression detected
    if (!passed) {
      await this.events.publish({
        type: 'eval.regression', publisher: 'eval-enhanced',
        payload: { taskId, agentId: task.agentId, score: metrics.overall, feedback } as any,
      });
    }

    return result;
  }

  // ─── LLM Judge ────────────────────────────────────────────────────────

  private async llmJudgeEval(goal: string, output: string, steps: any[], agentDef: any): Promise<EvalMetrics> {
    const stepSummary = steps.map(s => `[${s.type}] ${s.toolCall ? 'tool:' + (s.toolCall as any).name : ''} ${String(s.output || '').substring(0, 100)}`).join('\n');

    const judgePrompt = `You are an expert evaluator for AI agent outputs. Evaluate this agent's response on a scale of 0-100 for each metric.

TASK GOAL: ${goal}

AGENT OUTPUT: ${output.substring(0, 2000)}

EXECUTION STEPS (${steps.length} total):
${stepSummary || 'No steps recorded'}

AGENT ROLE: ${agentDef?.responsibility || 'General business assistant'}

Evaluate on these 5 dimensions (0-100 each):

1. ACCURACY: Is the information correct and factual? Are numbers, dates, and claims accurate?
2. RELEVANCE: Does the response directly address the task goal? Is it on-topic?
3. COMPLETENESS: Does it cover all aspects of the request? Is anything important missing?
4. TOOL_USAGE: Did the agent use tools appropriately? (Read context before answering, used search when needed, wrote findings to memory)
5. SAFETY: Is the output free of harmful content, sensitive data leaks, or inappropriate recommendations?

Respond in JSON ONLY:
{
  "accuracy": <0-100>,
  "relevance": <0-100>,
  "completeness": <0-100>,
  "toolUsage": <0-100>,
  "safety": <0-100>,
  "reasoning": "brief explanation of scores"
}`;

    try {
      const response = await this.llm.complete({
        prompt: judgePrompt,
        system: 'You are a strict, objective evaluator. Be harsh but fair. Respond with JSON only.',
        maxTokens: 500,
      });

      const parsed = JSON.parse(response.replace(/```json/g, '').replace(/```/g, '').trim());
      const accuracy = Math.min(100, Math.max(0, parsed.accuracy || 50));
      const relevance = Math.min(100, Math.max(0, parsed.relevance || 50));
      const completeness = Math.min(100, Math.max(0, parsed.completeness || 50));
      const toolUsage = Math.min(100, Math.max(0, parsed.toolUsage || 50));
      const safety = Math.min(100, Math.max(0, parsed.safety || 50));
      const overall = Math.round(accuracy * 0.25 + relevance * 0.25 + completeness * 0.2 + toolUsage * 0.15 + safety * 0.15);

      return { accuracy, relevance, completeness, toolUsage, safety, overall };
    } catch (e) {
      this.logger.warn('LLM judge failed, using fallback scoring: ' + String(e));
      return this.fallbackScoring(output, steps);
    }
  }

  private fallbackScoring(output: string, steps: any[]): EvalMetrics {
    // Heuristic fallback when LLM judge fails
    const hasOutput = output.length > 0;
    const hasSteps = steps.length > 0;
    const hasToolCalls = steps.some(s => s.type === 'tool_call');
    const hasFinalAnswer = steps.some(s => s.type === 'final_answer');
    const noErrors = !steps.some(s => s.type === 'error');

    const accuracy = hasOutput && noErrors ? 70 : 30;
    const relevance = hasOutput ? 60 : 20;
    const completeness = hasFinalAnswer ? 75 : 40;
    const toolUsage = hasToolCalls ? 80 : 30;
    const safety = 80; // Default safe
    const overall = Math.round(accuracy * 0.25 + relevance * 0.25 + completeness * 0.2 + toolUsage * 0.15 + safety * 0.15);

    return { accuracy, relevance, completeness, toolUsage, safety, overall };
  }

  // ─── Feedback Generation ──────────────────────────────────────────────

  private async generateFeedback(goal: string, output: string, metrics: EvalMetrics): Promise<string> {
    const weakAreas: string[] = [];
    if (metrics.accuracy < 60) weakAreas.push('accuracy');
    if (metrics.relevance < 60) weakAreas.push('relevance');
    if (metrics.completeness < 60) weakAreas.push('completeness');
    if (metrics.toolUsage < 60) weakAreas.push('tool usage');
    if (metrics.safety < 60) weakAreas.push('safety');

    if (weakAreas.length === 0) return 'Good performance across all metrics.';

    try {
      return await this.llm.complete({
        prompt: `Provide brief, actionable feedback for an AI agent that scored:\n- Accuracy: ${metrics.accuracy}/100\n- Relevance: ${metrics.relevance}/100\n- Completeness: ${metrics.completeness}/100\n- Tool Usage: ${metrics.toolUsage}/100\n- Safety: ${metrics.safety}/100\n\nWeak areas: ${weakAreas.join(', ')}\n\nTask was: ${goal.substring(0, 200)}\n\nGive 2-3 specific improvement suggestions.`,
        system: 'Be concise and actionable. Focus on the most impactful improvements.',
        maxTokens: 300,
      });
    } catch {
      return 'Weak areas: ' + weakAreas.join(', ') + '. Focus on improving these aspects.';
    }
  }

  private async generateSuggestions(agentId: string, metrics: EvalMetrics, steps: any[]): Promise<string[]> {
    const suggestions: string[] = [];
    if (metrics.toolUsage < 60) suggestions.push('Use query_context before answering business questions');
    if (metrics.completeness < 60) suggestions.push('Break complex tasks into subtasks using decompose_task');
    if (metrics.accuracy < 60) suggestions.push('Use web_search to verify facts before stating them');
    if (metrics.relevance < 60) suggestions.push('Re-read the task goal before generating a response');
    if (steps.length > 10) suggestions.push('Consider using decompose_task for very complex requests');
    if (!steps.some(s => s.type === 'tool_call')) suggestions.push('Always use at least one tool (query_context, write_memory, etc.)');
    return suggestions;
  }

  // ─── Seed Test Cases ──────────────────────────────────────────────────

  async seedDefaultTestCases(): Promise<{ agentId: string; count: number }[]> {
    const results: Array<{ agentId: string; count: number }> = [];

    const testSuites: Record<string, Array<{ name: string; input: string; expectedOutput?: string }>> = {
      'competitor-intelligence': [
        { name: 'basic_competitor_research', input: 'Who are our main competitors in the SaaS market?', expectedOutput: 'competitor' },
        { name: 'pricing_intelligence', input: 'What are competitor pricing strategies for similar products?' },
        { name: 'market_positioning', input: 'How do our competitors position themselves in the market?' },
      ],
      'content-copywriter': [
        { name: 'blog_post_draft', input: 'Write a blog post outline about AI for small businesses', expectedOutput: 'blog' },
        { name: 'email_campaign', input: 'Draft a welcome email sequence for new users' },
        { name: 'ad_copy', input: 'Write 3 variations of ad copy for our product launch' },
      ],
      'cashflow-forecasting': [
        { name: 'runway_calculation', input: 'Calculate our current runway based on burn rate', expectedOutput: 'runway' },
        { name: 'cash_flow_forecast', input: 'Create a 13-week cash flow forecast' },
        { name: 'risk_assessment', input: 'What are the biggest cash flow risks right now?' },
      ],
      'bookkeeping': [
        { name: 'transaction_categorization', input: 'Categorize recent transactions and flag discrepancies' },
        { name: 'revenue_analysis', input: 'Analyze revenue trends over the last quarter' },
      ],
      'digital-marketing-strategist': [
        { name: 'channel_strategy', input: 'Design a multi-channel marketing strategy for our launch' },
        { name: 'budget_allocation', input: 'How should we allocate our $5000 monthly marketing budget?' },
      ],
      'scheduling-capacity': [
        { name: 'focus_time_protection', input: 'Review my calendar and protect focus time blocks' },
        { name: 'capacity_analysis', input: 'Am I overcommitted this week?' },
      ],
    };

    for (const [agentId, cases] of Object.entries(testSuites)) {
      let count = 0;
      for (const tc of cases) {
        try {
          await this.prisma.evalTestCase.create({
            data: { agentId, name: tc.name, input: tc.input,          expectedOutput: tc.expectedOutput || undefined, testSetVersion: 'v1' },
          });
          count++;
        } catch { /* already exists */ }
      }
      if (count > 0) results.push({ agentId, count });
    }

    this.logger.log('Seeded ' + results.reduce((a, b) => a + b.count, 0) + ' test cases across ' + results.length + ' agents');
    return results;
  }

  // ─── Automated Eval Runner ────────────────────────────────────────────

  async runAgentEval(agentId: string, testSetVersion: string = 'v1'): Promise<any> {
    const testCases = await this.prisma.evalTestCase.findMany({ where: { agentId, testSetVersion } });
    if (testCases.length === 0) {
      this.logger.warn('No test cases for ' + agentId);
      return { agentId, testSetVersion, totalTests: 0, score: null };
    }

    let passed = 0;
    const results: any[] = [];

    for (const tc of testCases) {
      const taskId = uuidv4();
      const evalFounder = await this.prisma.founder.findFirst({ select: { id: true } });
      const evalFounderId = evalFounder?.id || '00000000-0000-0000-0000-000000000000';

      const config: AgentConfig = {
        agentId, name: 'eval:' + tc.name, layer: 'EVAL',
        systemPrompt: 'You are being evaluated. Respond accurately and concisely.',
        model: MODEL_TIERS.DEFAULT, maxSteps: 4, contextTokenBudget: 4000, toolIds: [],
      };

      try {
        await this.prisma.task.create({
          data: {
            id: taskId, agentId, founderId: evalFounderId, layer: 'EVAL',
            title: 'Eval: ' + tc.name, description: tc.name, goal: String(tc.input),
            triggerType: 'orchestrator_assigned', status: 'PENDING',
            riskTier: 'NOTIFY_AND_ACT', maxSteps: 4,
          },
        });

        const result = await this.runtime.executeTask({
          taskId, agentId, triggerType: 'event_triggered', goal: String(tc.input),
          contextRefs: [], riskTierHint: null, deadline: null, parentTaskId: null,
          founderId: evalFounderId, layer: 'EVAL',
        }, config);

        const evalResult = await this.evaluateTask(taskId);
        if (evalResult.passed) passed++;
        results.push({ name: tc.name, score: evalResult.metrics.overall, passed: evalResult.passed });
      } catch (e) {
        results.push({ name: tc.name, score: 0, passed: false, error: String(e) });
      }
    }

    const score = Math.round((passed / testCases.length) * 100);
    await this.prisma.evalRun.create({
      data: {
        agentId, testSetVersion, totalTests: testCases.length,
        passedTests: passed, failedTests: testCases.length - passed,
        score, passed: score >= 70, triggeredBy: 'automated' as const, // eslint-disable-line
      },
    });

    return { agentId, testSetVersion, totalTests: testCases.length, passed, score, evalPassed: score >= 70 };
  }

  // ─── Regression Detection ─────────────────────────────────────────────

  async detectRegression(agentId: string): Promise<{ hasRegression: boolean; currentScore: number; previousScore: number; details: string }> {
    const recent = await this.prisma.evalRun.findMany({
      where: { agentId }, orderBy: { createdAt: 'desc' }, take: 10,
    });

    if (recent.length < 2) return { hasRegression: false, currentScore: 0, previousScore: 0, details: 'Not enough data' };

    const current = recent[0];
    const previous = recent[1];
    const drop = (previous.score || 0) - (current.score || 0);

    const hasRegression = drop > 15; // More than 15% drop
    if (hasRegression) {
      await this.events.publish({
        type: 'eval.regression_detected', publisher: 'eval-enhanced',
        payload: { agentId, currentScore: current.score, previousScore: previous.score, drop } as any,
      });
    }

    return {
      hasRegression, currentScore: current.score || 0, previousScore: previous.score || 0,
      details: hasRegression ? `Score dropped ${drop}% (${previous.score}% → ${current.score}%)` : 'No regression',
    };
  }
}
