import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/jwt-auth.decorator';
import { OnboardingService } from './onboarding.service';
import { ContextCompletenessService } from './context-completeness.service';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(
    private onboarding: OnboardingService,
    private completeness: ContextCompletenessService,
  ) {}

  @Get('status')
  async getStatus(@CurrentUser('id') founderId: string) {
    const isComplete = await this.onboarding.isOnboardingComplete(founderId);
    const state = await this.onboarding.getOnboardingState(founderId);
    return {
      isOnboardingComplete: isComplete,
      questionCount: state.questionCount,
      maxQuestions: state.maxQuestions,
      firstActionProposed: state.firstActionProposed,
      firstActionCompleted: state.firstActionCompleted,
    };
  }

  @Get('completeness')
  async getCompleteness(@CurrentUser('id') founderId: string) {
    const layers = await this.completeness.getCompleteness(founderId);
    const overall = await this.completeness.getOverallScore(founderId);
    return { overall, layers };
  }

  @Get('opening')
  async getOpeningMessage(@CurrentUser('id') founderId: string) {
    const founder = await this.onboarding.getFounderInfo(founderId);
    if (!founder) throw new Error('Founder not found');
    const message = await this.onboarding.handleOpeningMessage(
      founderId,
      founder.name,
      founder.businessName || '',
    );
    return { message };
  }
}
