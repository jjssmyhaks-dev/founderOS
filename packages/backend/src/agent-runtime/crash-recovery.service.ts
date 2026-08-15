import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRuntimeService } from './agent-runtime.service';
import { AgentConfig, MODEL_TIERS } from './types';

@Injectable()
export class CrashRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(CrashRecoveryService.name);

  constructor(
    private prisma: PrismaService,
    private runtime: AgentRuntimeService,
  ) {}

  async onModuleInit() {
    try {
      const stalledTasks = await this.prisma.task.findMany({
        where: { status: 'RUNNING' },
      });

      if (stalledTasks.length === 0) {
        this.logger.log('No stalled tasks to recover');
        return;
      }

      this.logger.warn('Found ' + stalledTasks.length + ' stalled RUNNING tasks - recovering...');

      for (const task of stalledTasks) {
        const steps = await this.prisma.taskStep.findMany({
          where: { taskId: task.id },
          orderBy: { stepNumber: 'asc' },
        });
        const lastStep = steps.length > 0 ? steps[steps.length - 1].stepNumber : 0;

        if (lastStep >= (task.maxSteps || 8)) {
          await this.prisma.task.update({
            where: { id: task.id },
            data: { status: 'FAILED', error: 'Crash recovery: max steps reached before restart', completedAt: new Date() },
          });
          this.logger.warn('Task ' + task.id + ' marked failed (max steps reached)');
          continue;
        }

        const config: AgentConfig = {
          agentId: task.agentId || '',
          name: '',
          layer: task.layer,
          systemPrompt: '',
          model: task.modelOverride || MODEL_TIERS.DEFAULT,
          maxSteps: task.maxSteps || 8,
          contextTokenBudget: 8000,
          toolIds: [],
        };

        this.logger.log('Resuming task ' + task.id + ' from step ' + (lastStep + 1));
        // Resume via approval-like path - load history and continue
        this.runtime.resumeAfterApproval(task.id, 'approved', 'Crash recovery: continuing from step ' + (lastStep + 1)).catch((e) => {
          this.logger.error('Failed to resume task ' + task.id + ': ' + String(e));
        });
      }
    } catch (e) {
      this.logger.error('Crash recovery failed: ' + String(e));
    }
  }
}
