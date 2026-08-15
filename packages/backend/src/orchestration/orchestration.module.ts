import { Module } from '@nestjs/common';
import { OrchestrationService } from './orchestration.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/events.module';
import { TaskModule } from '../tasks/tasks.module';
import { ContextModule } from '../context/context.module';
import { ActivityModule } from '../activity/activity.module';
import { LlmModule } from '../llm/llm.module';
import { ResearchLayerModule } from '../layers/research/research-layer.module';
import { MarketingLayerModule } from '../layers/marketing/marketing-layer.module';
import { OperationsLayerModule } from '../layers/operations/operations-layer.module';
import { FinanceLayerModule } from '../layers/finance/finance-layer.module';

@Module({
  imports: [PrismaModule, EventModule, TaskModule, ContextModule, ActivityModule, LlmModule, ResearchLayerModule, MarketingLayerModule, OperationsLayerModule, FinanceLayerModule],
  providers: [OrchestrationService],
  exports: [OrchestrationService],
})
export class OrchestrationModule {}