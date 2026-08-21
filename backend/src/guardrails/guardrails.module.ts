import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/events.module';
import { LlmModule } from '../llm/llm.module';
import { GuardrailsService } from './guardrails.service';

@Module({
  imports: [PrismaModule, EventModule, LlmModule],
  providers: [GuardrailsService],
  exports: [GuardrailsService],
})
export class GuardrailsModule {}
