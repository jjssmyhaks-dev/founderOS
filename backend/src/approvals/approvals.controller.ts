import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApprovalService } from './approvals.service';
import { ResolveApprovalDto } from './dto/approvals.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/jwt-auth.decorator';

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  async getPendingQueue(@CurrentUser('id') founderId: string) {
    return this.approvalService.getPendingQueue(founderId);
  }

  @Post(':id/approve')
  async approve(@CurrentUser('id') founderId: string, @Param('id') id: string) {
    return this.approvalService.approve(id, founderId);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser('id') founderId: string,
    @Param('id') id: string,
    @Body() dto: ResolveApprovalDto,
  ) {
    return this.approvalService.reject(id, founderId, dto.resolution);
  }

  @Post(':id/edit')
  async edit(
    @CurrentUser('id') founderId: string,
    @Param('id') id: string,
    @Body() dto: ResolveApprovalDto,
  ) {
    return this.approvalService.edit(id, founderId, dto.editedAction!);
  }
}
