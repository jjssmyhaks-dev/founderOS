import { Module, Global } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/events.module';

@Global()
@Module({
  imports: [PrismaModule, EventModule],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}