import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsNumber, IsNotEmpty } from 'class-validator';
import { BoneSite, WHOCategory } from '../enums';

/**
 * Save Bone Density ERM Data DTO
 * Used for saving/updating bone density scan ERM data
 */
export class SaveBoneDensityErmDto {
  @ApiProperty({
    description: 'Bone scan site',
    enum: BoneSite,
    example: BoneSite.LUMBAR_SPINE,
  })
  @IsEnum(BoneSite)
  @IsNotEmpty()
  site: BoneSite;

  @ApiProperty({ required: false, example: '0.912' })
  @IsOptional()
  @IsString()
  bmdValue?: string;

  @ApiProperty({ required: false, example: 'g/cm²' })
  @IsOptional()
  @IsString()
  bmdUnit?: string;

  @ApiProperty({ required: false, example: -1.5 })
  @IsOptional()
  @IsNumber()
  tScore?: number;

  @ApiProperty({ required: false, example: -0.8 })
  @IsOptional()
  @IsNumber()
  zScore?: number;

  @ApiProperty({ required: false, enum: WHOCategory })
  @IsOptional()
  @IsEnum(WHOCategory)
  whoCategory?: WHOCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  fractureRiskComment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  recommendations?: string;
}
