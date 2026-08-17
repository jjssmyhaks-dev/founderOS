import { Module } from '@nestjs/common';
import { ResearchLayerService } from './research-layer.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventModule } from '../../events/events.module';
import { AgentRuntimeModule } from '../../agent-runtime/agent-runtime.module';
import { ActivityModule } from '../../activity/activity.module';

@Module({
  imports: [PrismaModule, EventModule, AgentRuntimeModule, ActivityModule],
  providers: [ResearchLayerService],
  exports: [ResearchLayerService],
})
export class ResearchLayerModule {}