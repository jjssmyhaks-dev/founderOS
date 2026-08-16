import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OrchestrationModule } from '../orchestration/orchestration.module';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [PrismaModule, OrchestrationModule, OnboardingModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
