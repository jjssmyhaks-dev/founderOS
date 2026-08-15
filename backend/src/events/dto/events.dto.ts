import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PublishEventDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  publisher: string;

  payload: Record<string, unknown>;

  @IsOptional()
  @IsString()
  correlationId?: string;
}

export class SubscribeEventDto {
  @IsString()
  @IsNotEmpty()
  agentId: string;

  @IsArray()
  @IsString({ each: true })
  eventTypes: string[];
}
