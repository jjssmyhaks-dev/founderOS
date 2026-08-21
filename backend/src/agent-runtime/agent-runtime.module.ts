import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MemoryModule } from '../memory/memory.module';
import { LlmModule } from '../llm/llm.module';
import { EventModule } from '../events/events.module';
import { ActivityModule } from '../activity/activity.module';
import { ObservabilityModule } from '../observability/observability.module';
import { ContextModule } from '../context/context.module';
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
import { GuardrailsModule } from '../guardrails/guardrails.module';
import { SelfImprovementService } from './self-improvement.service';
import { AgenticHarnessService } from './agentic-harness.service';

@Module({
  imports: [
    PrismaModule, MemoryModule, LlmModule, EventModule,
    ActivityModule, ObservabilityModule, ContextModule, GuardrailsModule,
  ],
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
    SelfImprovementService,
    AgenticHarnessService,
  ],
  exports: [
    AgentRuntimeService, ToolRegistryService, McpConnectorExecutor,
    ScheduledTriggerService, SelfImprovementService, AgenticHarnessService,
  ],
  controllers: [AgentRuntimeController],
})
export class AgentRuntimeModule {}
