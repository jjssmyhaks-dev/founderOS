import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TenancyMiddleware } from './middleware/tenancy.middleware';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { AuthSecurityService } from './services/auth-security.service';

@Module({
  providers: [AuthSecurityService],
  exports: [AuthSecurityService],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenancyMiddleware).forRoutes('*');
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
