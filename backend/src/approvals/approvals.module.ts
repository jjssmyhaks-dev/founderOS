import { Module } from '@nestjs/common';
import { ApprovalService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';

@Module({
  controllers: [ApprovalsController],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalModule {}
