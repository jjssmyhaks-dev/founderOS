import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TaskService } from './tasks.service';
import { CreateTaskDto, UpdateTaskStatusDto } from './dto/tasks.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/jwt-auth.decorator';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created' })
  async create(@CurrentUser('id') founderId: string, @Body() dto: CreateTaskDto) {
    return this.taskService.create(founderId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tasks with optional filters' })
  @ApiQuery({ name: 'layer', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'agentId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiResponse({ status: 200, description: 'Paginated task list' })
  async findAll(
    @CurrentUser('id') founderId: string,
    @Query() filters: { layer?: string; status?: string; agentId?: string; limit?: string; offset?: string },
  ) {
    return this.taskService.findAll(founderId, {
      layer: filters.layer,
      status: filters.status,
      agentId: filters.agentId,
      limit: filters.limit ? parseInt(filters.limit, 10) : undefined,
      offset: filters.offset ? parseInt(filters.offset, 10) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task details' })
  async findOne(@CurrentUser('id') founderId: string, @Param('id') id: string) {
    return this.taskService.findOne(id, founderId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update task status' })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task updated' })
  async updateStatus(
    @CurrentUser('id') founderId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.taskService.updateStatus(id, founderId, dto);
  }
}
