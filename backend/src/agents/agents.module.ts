import { Module } from '@nestjs/common';
import { AgentService } from './agents.service';
import { AgentsController } from './agents.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, EventModule],
  controllers: [AgentsController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
