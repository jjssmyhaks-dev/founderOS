import { Module } from '@nestjs/common';
import { ApprovalService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [ApprovalsController],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalModule {}