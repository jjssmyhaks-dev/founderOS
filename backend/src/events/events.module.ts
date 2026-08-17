import { Module } from '@nestjs/common';
import { EventService } from './events.service';
import { EventsController } from './events.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EventsController],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}