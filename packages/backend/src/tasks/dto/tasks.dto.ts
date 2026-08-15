import { IsEnum, IsOptional, IsString, IsObject } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  layer?: string;

  @IsOptional()
  @IsString()
  riskTier?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  parentTaskId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateTaskStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsString()
  error?: string;
}

export class TaskFilterDto {
  @IsOptional()
  @IsString()
  layer?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  limit?: number;
  offset?: number;
}
