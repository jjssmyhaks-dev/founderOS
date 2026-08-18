import { Module } from '@nestjs/common';
import { ApprovalService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/events.module';
import { TaskModule } from '../tasks/tasks.module';
import { ActivityModule } from '../activity/activity.module';
import { AgentRuntimeModule } from '../agent-runtime/agent-runtime.module';

@Module({
  imports: [PrismaModule, CommonModule, EventModule, TaskModule, ActivityModule, AgentRuntimeModule],
  controllers: [ApprovalsController],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalModule {}