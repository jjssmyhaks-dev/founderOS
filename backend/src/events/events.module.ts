import { Module } from '@nestjs/common';
import { EventService } from './events.service';
import { EventsController } from './events.controller';

@Module({
  controllers: [EventsController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
