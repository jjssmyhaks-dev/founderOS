import { Module } from '@nestjs/common';
import { ConnectorService } from './connectors.service';
import { ConnectorsController } from './connectors.controller';

@Module({
  controllers: [ConnectorsController],
  providers: [ConnectorService],
  exports: [ConnectorService],
})
export class ConnectorModule {}
