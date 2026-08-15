import { IsOptional, IsString } from 'class-validator';

export class ResolveApprovalDto {
  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString()
  editedAction?: string;
}
