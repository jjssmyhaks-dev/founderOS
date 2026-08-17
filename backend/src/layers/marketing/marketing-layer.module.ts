import { Module } from '@nestjs/common';
import { MarketingLayerService } from './marketing-layer.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EventModule } from '../../events/events.module';
import { AgentRuntimeModule } from '../../agent-runtime/agent-runtime.module';
import { ActivityModule } from '../../activity/activity.module';

@Module({
  imports: [PrismaModule, EventModule, AgentRuntimeModule, ActivityModule],
  providers: [MarketingLayerService],
  exports: [MarketingLayerService],
})
export class MarketingLayerModule {}