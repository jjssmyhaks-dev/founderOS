import { Controller, Post, Get, Body, Req, UseGuards, Patch } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto, LoginDto } from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/jwt-auth.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser('id') founderId: string) {
    return this.authService.getProfile(founderId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('autonomy-settings')
  async updateAutonomy(@CurrentUser('id') founderId: string, @Body() settings: any) {
    return this.authService.updateAutonomySettings(founderId, settings);
  }
}
