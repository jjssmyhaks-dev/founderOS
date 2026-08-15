import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LlmModule } from '../llm/llm.module';
import { EventModule } from '../events/events.module';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';

@Module({
  imports: [PrismaModule, LlmModule, EventModule],
  providers: [MemoryService],
  exports: [MemoryService],
  controllers: [MemoryController],
})
export class MemoryModule {}
