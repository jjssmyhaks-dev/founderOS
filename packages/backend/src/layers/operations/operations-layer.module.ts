import { Module } from '@nestjs/common';
import { OperationsLayerService } from './operations-layer.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventModule } from '../../events/events.module';
import { AgentRuntimeModule } from '../../agent-runtime/agent-runtime.module';
import { ActivityModule } from '../../activity/activity.module';

@Module({
  providers: [OperationsLayerService],
  exports: [OperationsLayerService],
})
export class OperationsLayerModule {}
