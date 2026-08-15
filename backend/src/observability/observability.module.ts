import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/events.module';
import { ActivityModule } from '../activity/activity.module';
import { AgentRuntimeModule } from '../agent-runtime/agent-runtime.module';
import { SpanEmitterService } from './span-emitter.service';
import { TraceService } from './trace.service';
import { AlertingService } from './alerting.service';
import { EvalService } from './eval.service';
import { ObservabilityController } from './observability.controller';

@Module({
  imports: [PrismaModule, EventModule, ActivityModule, AgentRuntimeModule],
  providers: [SpanEmitterService, TraceService, AlertingService, EvalService],
  exports: [SpanEmitterService, TraceService],
  controllers: [ObservabilityController],
})
export class ObservabilityModule {}
