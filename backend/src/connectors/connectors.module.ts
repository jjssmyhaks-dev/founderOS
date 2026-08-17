import { Module } from '@nestjs/common';
import { ConnectorService } from './connectors.service';
import { ConnectorsController } from './connectors.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/events.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [PrismaModule, EventModule, ActivityModule],
  controllers: [ConnectorsController],
  providers: [ConnectorService],
  exports: [ConnectorService],
})
export class ConnectorModule {}