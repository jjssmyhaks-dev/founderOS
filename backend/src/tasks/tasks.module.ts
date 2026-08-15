import { Module } from '@nestjs/common';
import { TaskService } from './tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  controllers: [TasksController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
