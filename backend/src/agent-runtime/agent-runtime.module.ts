import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MemoryModule } from '../memory/memory.module';
import { LlmModule } from '../llm/llm.module';
import { EventModule } from '../events/events.module';
import { ActivityModule } from '../activity/activity.module';
import { ObservabilityModule } from '../observability/observability.module';
import { AgentRuntimeService } from './agent-runtime.service';
import { ToolRegistryService } from './tool-registry.service';
import { ContextAssemblerService } from './context-assembler.service';
import { RiskGateService } from './risk-gate.service';
import { McpConnectorExecutor } from './mcp-connector-executor.service';
import { TokenBudgetService } from './token-budget.service';
import { HandoffService } from './handoff.service';
import { CrashRecoveryService } from './crash-recovery.service';
import { ScheduledTriggerService } from './scheduled-trigger.service';
import { AgentRuntimeController } from './agent-runtime.controller';

@Module({
  imports: [PrismaModule, MemoryModule, LlmModule, EventModule, ActivityModule, ObservabilityModule],
  providers: [
    AgentRuntimeService,
    ToolRegistryService,
    ContextAssemblerService,
    RiskGateService,
    McpConnectorExecutor,
    TokenBudgetService,
    HandoffService,
    CrashRecoveryService,
    ScheduledTriggerService,
  ],
  exports: [AgentRuntimeService, ToolRegistryService, McpConnectorExecutor, ScheduledTriggerService],
  controllers: [AgentRuntimeController],
})
export class AgentRuntimeModule {}