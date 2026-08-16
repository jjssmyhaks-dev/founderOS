import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';
import { MemoryModule } from '../memory/memory.module';
import { OnboardingService } from './onboarding.service';
import { ContextCompletenessService } from './context-completeness.service';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [PrismaModule, LlmModule, MemoryModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, ContextCompletenessService],
  exports: [OnboardingService, ContextCompletenessService],
})
export class OnboardingModule {}
