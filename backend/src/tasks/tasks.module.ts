import { Module } from '@nestjs/common';
import { TaskService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/events.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [PrismaModule, EventModule, ActivityModule],
  controllers: [TasksController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}