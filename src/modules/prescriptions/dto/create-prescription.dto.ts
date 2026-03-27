import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MedicineItemDto } from './medicine-item.dto';

/**
 * Create Prescription DTO (Step 7)
 *
 * Used for creating or updating an electronic prescription.
 */
export class CreatePrescriptionDto {
  @ApiProperty({
    description: "General notes from the doctor (optional)",
    example: 'Patient must stay well-hydrated and avoid alcohol during the course of treatment.',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Doctor note must be a string' })
  doctorNote?: string;

  @ApiProperty({
    description: 'List of medicines with usage instructions (at least one required)',
    type: [MedicineItemDto],
    example: [
      {
        medicineId: '123e4567-e89b-12d3-a456-426614174000',
        quantity: 14,
        note: 'Take after meals to reduce stomach irritation',
        checkOut: 'Take 1 tablet per dose, twice daily (morning and evening), for 7 days',
      },
      {
        medicineId: '123e4567-e89b-12d3-a456-426614174001',
        quantity: 10,
        note: 'Apply a thin layer on affected area only',
        checkOut: 'Apply on the inflamed skin area, twice daily after cleansing',
      },
    ],
  })
  @IsArray({ message: 'Medicines must be an array' })
  @ArrayMinSize(1, { message: 'At least one medicine is required' })
  @ValidateNested({ each: true })
  @Type(() => MedicineItemDto)
  medicines: MedicineItemDto[];
}

