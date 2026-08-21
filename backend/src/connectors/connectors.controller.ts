import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'List available connectors and their status' })
  @ApiResponse({ status: 200, description: 'Connector registry with connection status' })
  async getRegistry(@CurrentUser('id') founderId: string) {
    return this.connectorService.getRegistry(founderId);
  }

  @Post(':name/connect')
  @ApiOperation({ summary: 'Connect an external service' })
  @ApiParam({ name: 'name', description: 'Connector name (e.g. whatsapp, razorpay)' })
  @ApiResponse({ status: 200, description: 'Connector connected successfully' })
  async connect(
    @CurrentUser('id') founderId: string,
    @Param('name') name: string,
  ) {
    return this.connectorService.connect(founderId, name);
  }

  @Delete(':name/disconnect')
  @ApiOperation({ summary: 'Disconnect an external service' })
  @ApiParam({ name: 'name', description: 'Connector name' })
  @ApiResponse({ status: 200, description: 'Connector disconnected' })
  async disconnect(
    @CurrentUser('id') founderId: string,
    @Param('name') name: string,
  ) {
    return this.connectorService.disconnect(founderId, name);
  }

  @Get(':name/health')
  @ApiOperation({ summary: 'Check connector health status' })
  @ApiParam({ name: 'name', description: 'Connector name' })
  @ApiResponse({ status: 200, description: 'Health check result' })
  async checkHealth(
    @CurrentUser('id') founderId: string,
    @Param('name') name: string,
  ) {
    return this.connectorService.checkHealth(founderId, name);
  }
}
