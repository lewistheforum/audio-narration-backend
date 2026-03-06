import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsArray, IsDateString } from 'class-validator';
import { BodySide } from '../enums';

/**
 * Save Ultrasound ERM Data DTO
 * Used for saving/updating ultrasound ERM data
 */
export class SaveUltrasoundErmDto {
  @ApiProperty({ required: false, example: 'US001' })
  @IsOptional()
  @IsString()
  serviceCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  indication?: string;

  @ApiProperty({ required: false, example: 'Shoulder' })
  @IsOptional()
  @IsString()
  bodySite?: string;

  @ApiProperty({ required: false, enum: BodySide })
  @IsOptional()
  @IsEnum(BodySide)
  side?: BodySide;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  technique?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  findings?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  measurements?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  conclusion?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  recommendations?: string;

  @ApiProperty({
    required: false,
    type: [String],
    example: ['https://example.com/ultrasound1.jpg'],
  })
  @IsOptional()
  @IsArray()
  imageUrls?: string[];

  @ApiProperty({ required: false, example: '2026-02-24T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  performedAt?: string;
}
