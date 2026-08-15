import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EventService } from './events.service';
import { PublishEventDto } from './dto/events.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/jwt-auth.decorator';

@ApiTags('Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventService: EventService) {}

  @Post('publish')
  async publish(@Body() dto: PublishEventDto) {
    return this.eventService.publish(dto);
  }

  @Get('subscriptions')
  async getSubscriptions(@Query('agentId') agentId?: string) {
    return this.eventService.getSubscriptions(agentId);
  }
}
