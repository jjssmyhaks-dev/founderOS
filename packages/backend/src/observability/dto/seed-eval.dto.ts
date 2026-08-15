import { IsArray, ValidateNested, IsString, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class EvalTestCaseInput {
  @IsString()
  name: string;

  input: any;

  @IsOptional()
  expectedOutput?: any;

  @IsOptional()
  rubric?: any;
}

export class SeedEvalDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvalTestCaseInput)
  cases: EvalTestCaseInput[];
}
