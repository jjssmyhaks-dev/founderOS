import { Module, Global } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityController } from './activity.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/events.module';

@Global()
@Module({
  imports: [PrismaModule, EventModule],
  controllers: [ActivityController],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}