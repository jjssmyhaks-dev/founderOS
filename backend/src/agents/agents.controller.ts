import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'List all agents with stats' })
  @ApiResponse({ status: 200, description: 'Agent list with runtime stats' })
  async listAll(@CurrentUser('id') founderId: string) {
    return this.agentService.listAll(founderId);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Get agent activity feed' })
  @ApiParam({ name: 'id', description: 'Agent ID' })
  @ApiResponse({ status: 200, description: 'Activity entries for this agent' })
  async getActivity(
    @CurrentUser('id') founderId: string,
    @Param('id') agentId: string,
  ) {
    return this.agentService.getActivity(agentId, founderId);
  }
}
