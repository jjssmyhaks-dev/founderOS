import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/jwt-auth.decorator';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('message')
  async sendMessage(@CurrentUser('id') founderId: string, @Body() body: { content: string; sessionId?: string }) {
    return this.chatService.handleMessage(founderId, body.content, body.sessionId);
  }

  @Post('voice')
  async sendVoice(@CurrentUser('id') founderId: string, @Body() body: { audioData: string; format?: string }) {
    return this.chatService.handleVoice(founderId, body.audioData, body.format);
  }

  @Get('history')
  async getHistory(@CurrentUser('id') founderId: string, @Query('sessionId') sessionId?: string) {
    return this.chatService.getHistory(founderId, sessionId);
  }

  @Get('sessions')
  async getSessions(@CurrentUser('id') founderId: string) {
    return this.chatService.getSessions(founderId);
  }
}