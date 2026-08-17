import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ApprovalService } from './approvals.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/jwt-auth.decorator';

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  async getPending(@CurrentUser('id') founderId: string) {
    return this.approvalService.getPending(founderId);
  }

  @Post(':id/approve')
  async approve(@CurrentUser('id') founderId: string, @Param('id') id: string) {
    return this.approvalService.approve(id, founderId);
  }

  @Post(':id/reject')
  async reject(@CurrentUser('id') founderId: string, @Param('id') id: string) {
    return this.approvalService.reject(id, founderId);
  }

  @Post(':id/edit')
  async edit(@CurrentUser('id') founderId: string, @Param('id') id: string, @Body() body: { editedAction: string }) {
    return this.approvalService.edit(id, founderId, body.editedAction);
  }
}
