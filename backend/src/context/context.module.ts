import { Module } from '@nestjs/common';
import { ContextService } from './context.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [PrismaModule, LlmModule],
  providers: [ContextService],
  exports: [ContextService],
})
export class ContextModule {}