import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { MemoryService } from './memory.service';
import { WriteMemoryInput, RetrieveMemoryInput } from './types';

@Controller('memory')
export class MemoryController {
  constructor(private memory: MemoryService) {}

  @Post('write')
  async write(@Body() input: WriteMemoryInput) {
    return this.memory.writeMemory(input);
  }

  @Post('retrieve')
  async retrieve(@Body() input: RetrieveMemoryInput) {
    return this.memory.retrieveMemory(input);
  }

  @Get(':founderId')
  async getMemories(
    @Param('founderId') founderId: string,
    @Query('layer') layer?: string,
    @Query('memoryType') memoryType?: string,
  ) {
    return this.memory.getMemories(founderId, { layer, memoryType });
  }

  @Get(':founderId/stale')
  async getStale(@Param('founderId') founderId: string, @Query('days') days?: string) {
    return this.memory.getStaleCandidates(days ? parseInt(days) : 30);
  }
}
