import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get pending approvals' })
  @ApiResponse({ status: 200, description: 'List of pending approvals requiring founder action' })
  async getPending(@CurrentUser('id') founderId: string) {
    return this.approvalService.getPending(founderId);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a pending action' })
  @ApiParam({ name: 'id', description: 'Approval ID' })
  @ApiResponse({ status: 200, description: 'Action approved and executed' })
  async approve(@CurrentUser('id') founderId: string, @Param('id') id: string) {
    return this.approvalService.approve(id, founderId);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a pending action' })
  @ApiParam({ name: 'id', description: 'Approval ID' })
  @ApiResponse({ status: 200, description: 'Action rejected' })
  async reject(@CurrentUser('id') founderId: string, @Param('id') id: string) {
    return this.approvalService.reject(id, founderId);
  }

  @Post(':id/edit')
  @ApiOperation({ summary: 'Edit and approve a pending action' })
  @ApiParam({ name: 'id', description: 'Approval ID' })
  @ApiResponse({ status: 200, description: 'Edited action approved and executed' })
  async edit(@CurrentUser('id') founderId: string, @Param('id') id: string, @Body() body: { editedAction: string }) {
    return this.approvalService.edit(id, founderId, body.editedAction);
  }
}
