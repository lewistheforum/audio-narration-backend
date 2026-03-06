import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max, IsDateString } from 'class-validator';
import { BodySide, ImmediateOutcome } from '../enums';

/**
 * Save Procedure ERM Data DTO
 * Used for saving/updating procedure ERM data
 */
export class SaveProcedureErmDto {
  @ApiProperty({ required: false, example: 'PROC001' })
  @IsOptional()
  @IsString()
  procedureCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  indication?: string;

  @ApiProperty({ required: false, example: 'Knee joint' })
  @IsOptional()
  @IsString()
  bodySite?: string;

  @ApiProperty({ required: false, enum: BodySide })
  @IsOptional()
  @IsEnum(BodySide)
  side?: BodySide;

  @ApiProperty({ required: false, example: 'Local anesthesia' })
  @IsOptional()
  @IsString()
  anesthesiaType?: string;

  @ApiProperty({ required: false, example: '2026-02-24T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  performedStart?: string;

  @ApiProperty({ required: false, example: '2026-02-24T10:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  performedEnd?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  medications?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  devices?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, minimum: 0, maximum: 10, example: 7 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  painScoreBefore?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 10, example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  painScoreAfter?: number;

  @ApiProperty({ required: false, enum: ImmediateOutcome })
  @IsOptional()
  @IsEnum(ImmediateOutcome)
  immediateOutcome?: ImmediateOutcome;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  complications?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  postCareInstructions?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  followUpPlan?: string;
}
