import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { TenancyMiddleware } from './middleware/tenancy.middleware';
import { AuthSecurityService } from './services/auth-security.service';

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  providers: [TenancyMiddleware, AuthSecurityService, JwtService],
  exports: [TenancyMiddleware, AuthSecurityService],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenancyMiddleware).forRoutes('*');
  }
}
