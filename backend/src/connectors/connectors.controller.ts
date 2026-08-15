import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConnectorService } from './connectors.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/jwt-auth.decorator';

@ApiTags('Connectors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly connectorService: ConnectorService) {}

  @Get()
  async getRegistry(@CurrentUser('id') founderId: string) {
    return this.connectorService.getRegistry(founderId);
  }

  @Post(':name/connect')
  async connect(
    @CurrentUser('id') founderId: string,
    @Param('name') name: string,
  ) {
    return this.connectorService.connect(founderId, name);
  }

  @Delete(':name/disconnect')
  async disconnect(
    @CurrentUser('id') founderId: string,
    @Param('name') name: string,
  ) {
    return this.connectorService.disconnect(founderId, name);
  }

  @Get(':name/health')
  async checkHealth(
    @CurrentUser('id') founderId: string,
    @Param('name') name: string,
  ) {
    return this.connectorService.checkHealth(founderId, name);
  }
}
