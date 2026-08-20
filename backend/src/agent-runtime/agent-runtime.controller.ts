import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';

import { AgentRuntimeService } from './agent-runtime.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('agent-runtime')

export class AgentRuntimeController {
  constructor(
    private runtime: AgentRuntimeService,
    private prisma: PrismaService,
  ) {}

  @Post('execute')
  async execute(@Request() req: any, @Body() body: any) {
    const task = {
      taskId: body.taskId,
      agentId: body.agentId,
      triggerType: body.triggerType || 'orchestrator_assigned',
      goal: body.goal,
      contextRefs: body.contextRefs || [],
      riskTierHint: body.riskTierHint || null,
      deadline: body.deadline || null,
      parentTaskId: body.parentTaskId || null,
      founderId: req.user.id,
      layer: body.layer,
      traceId: body.traceId,
    };
    const config = {
      agentId: body.agentId,
      name: body.agentName || body.agentId,
      layer: body.layer,
      systemPrompt: body.systemPrompt || '',
      model: body.model || undefined,
      maxSteps: body.maxSteps || 8,
      contextTokenBudget: body.contextTokenBudget || 8000,
      toolIds: body.toolIds || [],
    };
    return this.runtime.executeTask(task, config);
  }

  @Post(':taskId/approve')
  async approve(@Param('taskId') taskId: string, @Body() body: any) {
    return this.runtime.resumeAfterApproval(taskId, 'approved');
  }

  @Post(':taskId/reject')
  async reject(@Param('taskId') taskId: string, @Body() body: any) {
    return this.runtime.resumeAfterApproval(taskId, 'rejected');
  }

  @Post(':taskId/edit')
  async edit(@Param('taskId') taskId: string, @Body() body: any) {
    return this.runtime.resumeAfterApproval(taskId, 'edited', body.editedAction);
  }

  @Get('tasks/:taskId/steps')
  async getTaskSteps(@Param('taskId') taskId: string) {
    return this.prisma.taskStep.findMany({
      where: { taskId },
      orderBy: { stepNumber: 'asc' },
    });
  }

  @Get('tasks/:taskId/trace')
  async getTaskTrace(@Param('taskId') taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return { error: 'Task not found' };
    const steps = await this.prisma.taskStep.findMany({
      where: { taskId },
      orderBy: { stepNumber: 'asc' },
    });
    return {
      task: {
        id: task.id, agentId: task.agentId, status: task.status,
        goal: task.goal, traceId: task.traceId,
        startedAt: task.startedAt, completedAt: task.completedAt,
        currentStep: task.currentStep, maxSteps: task.maxSteps,
        error: task.error, result: task.result,
      },
      steps: steps.map((s: any) => ({
        step: s.stepNumber, type: s.type,
        toolCall: s.toolCall, toolResult: s.toolResult,
        output: s.output, error: s.error, durationMs: s.durationMs,
      })),
    };
  }
  @Get('stats')
  async getStats() {
    const tasks = await this.prisma.task.findMany({ select: { agentId: true, status: true, currentStep: true, maxSteps: true, startedAt: true, completedAt: true } });
    const grouped: Record<string, any> = {};
    for (const t of tasks) {
      if (!grouped[t.agentId || "unknown"]) grouped[t.agentId || "unknown"] = { totalTasks: 0, completedTasks: 0, failedTasks: 0, approvalPending: 0, totalSteps: 0, totalDurationMs: 0 };
      const g = grouped[t.agentId || "unknown"];
      g.totalTasks++;
      if (t.status === 'COMPLETED') { g.completedTasks++; g.totalSteps += t.currentStep || 0; if (t.startedAt && t.completedAt) g.totalDurationMs += new Date(t.completedAt).getTime() - new Date(t.startedAt).getTime(); }
      if (t.status === 'FAILED') g.failedTasks++;
      if (t.status === 'AWAITING_APPROVAL') g.approvalPending++;
    }
    const agents = Object.entries(grouped).map(([agentId, g]) => ({ agentId, ...g, avgStepsPerTask: g.completedTasks > 0 ? g.totalSteps / g.completedTasks : 0, avgDurationMs: g.completedTasks > 0 ? g.totalDurationMs / g.completedTasks : 0 }));
    return { agents };
  }
}
