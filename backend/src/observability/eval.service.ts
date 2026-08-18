import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRuntimeService } from '../agent-runtime/agent-runtime.service';
import { EventService } from '../events/events.service';
import { v4 as uuidv4 } from 'uuid';
import { AgentConfig, MODEL_TIERS } from '../agent-runtime/types';

@Injectable()
export class EvalService {
  private readonly logger = new Logger(EvalService.name);

  constructor(
    private prisma: PrismaService,
    private runtime: AgentRuntimeService,
    private events: EventService,
  ) {}

  async runEval(agentId: string, testSetVersion: string = 'v1', triggeredBy: string = 'manual'): Promise<any> {
    this.logger.log('Running eval for ' + agentId + ' (' + testSetVersion + ')');
    const testCases = await this.prisma.evalTestCase.findMany({ where: { agentId, testSetVersion } });
    if (testCases.length === 0) {
      this.logger.warn('No test cases for ' + agentId + ' ' + testSetVersion);
      return { agentId, testSetVersion, totalTests: 0, passedTests: 0, score: null, passed: false };
    }

    let passed = 0;
    let failed = 0;
    const results: any[] = [];

    for (const tc of testCases) {
      try {
        const taskId = uuidv4();
        const config: AgentConfig = {
          agentId, name: 'eval:' + tc.name, layer: 'EVAL',
          systemPrompt: 'You are being evaluated. Respond accurately and concisely.',
          model: MODEL_TIERS.DEFAULT, maxSteps: 4, contextTokenBudget: 4000, toolIds: [],
        };
        await this.prisma.task.create({ data: { id: taskId, agentId, founderId: 'system', layer: 'EVAL', title: 'Eval: ' + tc.name, description: 'Eval: ' + tc.name, goal: String(tc.input), triggerType: 'orchestrator_assigned', status: 'PENDING', riskTier: 'NOTIFY_AND_ACT', maxSteps: 4 } });

        const result = await this.runtime.executeTask({
          taskId, agentId, triggerType: 'event_triggered', goal: String(tc.input),
          contextRefs: [], riskTierHint: null, deadline: null, parentTaskId: null, founderId: 'system', layer: 'EVAL',
        }, config);

        const evalPassed = result.status === 'completed' && this.evaluateOutput(result.result || '', tc);
        if (evalPassed) passed++; else failed++;
        results.push({ name: tc.name, passed: evalPassed, status: result.status, result: (result.result || '').substring(0, 200) });
      } catch (e) {
        failed++;
        results.push({ name: tc.name, passed: false, error: String(e) });
      }
    }

    const score = testCases.length > 0 ? Math.round((passed / testCases.length) * 100) : null;
    const runPassed = score !== null && score >= 70;

    await this.prisma.evalRun.create({
      data: { agentId, testSetVersion, totalTests: testCases.length, passedTests: passed, failedTests: failed, score, passed: runPassed, triggeredBy },
    });

    if (!runPassed) {
      await this.events.publish({ type: 'system.eval.regression_detected', publisher: 'eval', payload: { agentId, score, testSetVersion, triggeredBy } as any });
    }

    this.logger.log('Eval ' + agentId + ': ' + score + '% (' + passed + '/' + testCases.length + ')');
    return { agentId, testSetVersion, totalTests: testCases.length, passedTests: passed, failedTests: failed, score, passed: runPassed, results };
  }

  private evaluateOutput(output: string, tc: any): boolean {
    if (!tc.expectedOutput) return output.length > 0;
    if (typeof tc.expectedOutput === 'string') {
      const expected = tc.expectedOutput.toLowerCase();
      return output.toLowerCase().includes(expected);
    }
    if (typeof tc.expectedOutput === 'object' && tc.expectedOutput.keywords) {
      const outputLower = output.toLowerCase();
      return (tc.expectedOutput.keywords as string[]).every((k: string) => outputLower.includes(k.toLowerCase()));
    }
    return output.length > 0;
  }

  async seedTestCases(agentId: string, cases: Array<{ name: string; input: any; expectedOutput?: any; rubric?: any }>): Promise<number> {
    let count = 0;
    for (const c of cases) {
      try {
        await this.prisma.evalTestCase.create({ data: { agentId, name: c.name, input: c.input, expectedOutput: c.expectedOutput || null, rubric: c.rubric || null } });
        count++;
      } catch (e) {
        this.logger.warn('Seed skip ' + c.name + ': ' + String(e));
      }
    }
    return count;
  }

  async getEvalHistory(agentId?: string, limit: number = 20): Promise<any[]> {
    const where: any = {};
    if (agentId) where.agentId = agentId;
    return this.prisma.evalRun.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
  }
}
