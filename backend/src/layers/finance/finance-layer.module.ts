import { Module } from '@nestjs/common';
import { FinanceLayerService } from './finance-layer.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventModule } from '../../events/events.module';
import { AgentRuntimeModule } from '../../agent-runtime/agent-runtime.module';
import { ActivityModule } from '../../activity/activity.module';

@Module({
  imports: [PrismaModule, EventModule, AgentRuntimeModule, ActivityModule],
  providers: [FinanceLayerService],
  exports: [FinanceLayerService],
})
export class FinanceLayerModule {}