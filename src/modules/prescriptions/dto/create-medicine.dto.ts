import {
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Create Medicine DTO
 * 
 * Data Transfer Object for creating new medicine records
 */
export class CreateMedicineDto {
  @ApiProperty({
    description: 'Medicine name (brand or generic)',
    example: 'Paracetamol 500mg',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Primary description (active ingredients, strength, form)',
    example: '500mg Tablet',
  })
  @IsOptional()
  @IsString()
  subtitle0?: string;

  @ApiPropertyOptional({
    description: 'Secondary description (manufacturer, packaging)',
    example: 'Manufactured by ABC Pharma',
  })
  @IsOptional()
  @IsString()
  subtitle1?: string;

  @ApiPropertyOptional({
    description: 'Tertiary description (storage conditions, notes)',
    example: 'Store below 30°C in dry place',
  })
  @IsOptional()
  @IsString()
  subtitle2?: string;

  @ApiPropertyOptional({
    description: 'Quaternary description',
  })
  @IsOptional()
  @IsString()
  subtitle3?: string;

  @ApiPropertyOptional({
    description: 'Quinary description',
  })
  @IsOptional()
  @IsString()
  subtitle4?: string;

  @ApiPropertyOptional({
    description: 'Known side effects and adverse reactions',
    example: 'Drowsiness, nausea, headache',
  })
  @IsOptional()
  @IsString()
  sideEffect?: string;

  @ApiPropertyOptional({
    description: 'Usage instructions and dosage',
    example: 'Take 1 tablet every 6 hours after meals. Maximum 4 tablets per day.',
  })
  @IsOptional()
  @IsString()
  used?: string;

  @ApiPropertyOptional({
    description: 'Chemical classification',
    example: 'NSAIDs',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  chemicalClass?: string;

  @ApiPropertyOptional({
    description: 'Whether the medicine is habit-forming (controlled substance)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  habitForming?: boolean;

  @ApiPropertyOptional({
    description: 'Therapeutic classification',
    example: 'Analgesic',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  therapeuticClass?: string;

  @ApiPropertyOptional({
    description: 'Action class (mechanism of action)',
    example: 'COX-2 inhibitor',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  actionClass?: string;
}
