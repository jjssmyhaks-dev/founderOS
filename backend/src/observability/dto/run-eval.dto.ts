import { IsString, IsOptional } from 'class-validator';

export class RunEvalDto {
  @IsOptional()
  @IsString()
  testSetVersion?: string;

  @IsOptional()
  @IsString()
  triggeredBy?: string;
}
