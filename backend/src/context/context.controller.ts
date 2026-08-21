import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ContextService, CreateContextNoteDto } from './context.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/jwt-auth.decorator';

@ApiTags('Context')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('context')
export class ContextController {
  constructor(private readonly contextService: ContextService) {}

  @Get()
  @ApiOperation({ summary: 'List context notes for the founder' })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category' })
  @ApiResponse({ status: 200, description: 'List of context notes' })
  async findAll(@CurrentUser('id') founderId: string, @Query('category') category?: string) {
    return this.contextService.findAll(founderId, category);
  }

  @Post()
  @ApiOperation({ summary: 'Create a context note' })
  @ApiResponse({ status: 201, description: 'Context note created' })
  async create(@CurrentUser('id') founderId: string, @Body() body: { category: string; content: string; sourceAgentId?: string; sourceTaskId?: string }) {
    const dto: CreateContextNoteDto = {
      founderId,
      category: body.category,
      content: body.content,
      sourceAgentId: body.sourceAgentId,
      sourceTaskId: body.sourceTaskId,
    };
    return this.contextService.create(dto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search context notes semantically' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results' })
  @ApiResponse({ status: 200, description: 'Relevant context notes' })
  async search(@CurrentUser('id') founderId: string, @Query('q') query: string, @Query('limit') limit?: string) {
    return this.contextService.queryContext(founderId, query, limit ? parseInt(limit) : 5);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a context note' })
  @ApiResponse({ status: 200, description: 'Context note updated' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async update(@CurrentUser('id') founderId: string, @Param('id') id: string, @Body() body: { content: string }) {
    return this.contextService.update(id, founderId, body.content);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a context note' })
  @ApiResponse({ status: 200, description: 'Context note deleted' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async remove(@CurrentUser('id') founderId: string, @Param('id') id: string) {
    return this.contextService.remove(id, founderId);
  }
}
