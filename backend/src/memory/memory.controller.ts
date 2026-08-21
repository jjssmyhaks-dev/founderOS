import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MemoryService } from './memory.service';
import { WriteMemoryInput, RetrieveMemoryInput } from './types';

@ApiTags('Memory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('memory')
export class MemoryController {
  constructor(private memory: MemoryService) {}

  @Post('write')
  @ApiOperation({ summary: 'Write memory with conflict detection' })
  @ApiResponse({ status: 201, description: 'Memory written (or conflict detected)' })
  async write(@Body() input: WriteMemoryInput) {
    return this.memory.writeMemory(input);
  }

  @Post('retrieve')
  @ApiOperation({ summary: 'Retrieve relevant memories by semantic search' })
  async retrieve(@Body() input: RetrieveMemoryInput) {
    return this.memory.retrieveMemory(input);
  }

  @Get(':founderId')
  @ApiOperation({ summary: 'List founder memories with optional filters' })
  async getMemories(
    @Param('founderId') founderId: string,
    @Query('layer') layer?: string,
    @Query('memoryType') memoryType?: string,
  ) {
    return this.memory.getMemories(founderId, { layer, memoryType });
  }

  @Get(':founderId/stale')
  @ApiOperation({ summary: 'Get stale memory candidates for consolidation' })
  async getStale(@Param('founderId') founderId: string, @Query('days') days?: string) {
    return this.memory.getStaleCandidates(days ? parseInt(days) : 30);
  }
}
