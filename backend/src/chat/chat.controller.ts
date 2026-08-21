import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/jwt-auth.decorator';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Post('message')
  @ApiOperation({ summary: 'Send a message to the orchestrator' })
  @ApiResponse({ status: 200, description: 'Agent response with routing decision' })
  async sendMessage(@CurrentUser('id') founderId: string, @Body() body: { content: string; sessionId?: string }) {
    return this.chatService.handleMessage(founderId, body.content, body.sessionId);
  }

  @Post('voice')
  @ApiOperation({ summary: 'Send voice input (base64 audio)' })
  @ApiResponse({ status: 200, description: 'Transcribed and processed' })
  async sendVoice(@CurrentUser('id') founderId: string, @Body() body: { audioData: string; format?: string }) {
    return this.chatService.handleVoice(founderId, body.audioData, body.format);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get chat history for current or specific session' })
  @ApiQuery({ name: 'sessionId', required: false })
  @ApiResponse({ status: 200, description: 'List of messages' })
  async getHistory(@CurrentUser('id') founderId: string, @Query('sessionId') sessionId?: string) {
    return this.chatService.getHistory(founderId, sessionId);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'List all chat sessions' })
  @ApiResponse({ status: 200, description: 'List of sessions with metadata' })
  async getSessions(@CurrentUser('id') founderId: string) {
    return this.chatService.getSessions(founderId);
  }
}