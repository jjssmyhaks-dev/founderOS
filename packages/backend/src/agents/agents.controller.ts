import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AgentService } from './agents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/jwt-auth.decorator';

@ApiTags('Agents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentService: AgentService) {}

  @Get()
  async listAll(@CurrentUser('id') founderId: string) {
    return this.agentService.listAll(founderId);
  }

  @Get(':id/activity')
  async getActivity(
    @CurrentUser('id') founderId: string,
    @Param('id') agentId: string,
  ) {
    return this.agentService.getActivity(agentId, founderId);
  }
}
