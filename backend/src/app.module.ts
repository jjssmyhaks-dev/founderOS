"use strict";

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { AgentModule } from './agents/agents.module';
import { TaskModule } from './tasks/tasks.module';
import { EventModule } from './events/events.module';
import { ApprovalModule } from './approvals/approvals.module';
import { ConnectorModule } from './connectors/connectors.module';
import { OrchestrationModule } from './orchestration/orchestration.module';
import { ContextModule } from './context/context.module';
import { ActivityModule } from './activity/activity.module';
import { LlmModule } from './llm/llm.module';
import { ResearchLayerModule } from './layers/research/research-layer.module';
import { MarketingLayerModule } from './layers/marketing/marketing-layer.module';
import { OperationsLayerModule } from './layers/operations/operations-layer.module';
import { FinanceLayerModule } from './layers/finance/finance-layer.module';
import { AgentRuntimeModule } from './agent-runtime/agent-runtime.module';
import { ObservabilityModule } from './observability/observability.module';
import { MemoryModule } from './memory/memory.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ChatModule,
    AgentModule,
    TaskModule,
    EventModule,
    ApprovalModule,
    ConnectorModule,
    OrchestrationModule,
    ContextModule,
    ActivityModule,
    LlmModule,
    ResearchLayerModule,
    MarketingLayerModule,
    OperationsLayerModule,
    FinanceLayerModule,
  ],
})
export class AppModule {}


