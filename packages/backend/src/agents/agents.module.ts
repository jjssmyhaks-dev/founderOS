import { Module } from '@nestjs/common';
import { AgentService } from './agents.service';
import { AgentsController } from './agents.controller';

@Module({
  controllers: [AgentsController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
