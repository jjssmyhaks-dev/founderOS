import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/jwt-auth.decorator';

@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get()
  async getFeed(
    @CurrentUser('id') founderId: string,
    @Query('agentId') agentId?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.activityService.getActivityFeed(founderId, {
      agentId,
      type,
      limit: limit ? parseInt(limit, 10) : 30,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }
}
