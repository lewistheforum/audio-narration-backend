import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, IsUUID, Min } from 'class-validator';

/**
 * Medicine Item DTO
 *
 * Represents a medicine in a prescription with usage instructions.
 */
export class MedicineItemDto {
  @ApiProperty({
    description: 'Medicine ID from the medicines table',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty({ message: 'Medicine ID is required' })
  @IsUUID('4', { message: 'Medicine ID must be a valid UUID v4' })
  medicineId: string;

  @ApiProperty({
    description: 'Quantity of the medicine (must be a positive integer greater than 0)',
    example: 10,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'Quantity is required' })
  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be greater than 0' })
  quantity: number;

  @ApiProperty({
    description: 'Additional notes for the medicine (e.g. take after meals)',
    example: 'Take 2 tablets per dose, 3 times daily after meals, for 7 days',
  })
  @IsNotEmpty({ message: 'Note is required' })
  @IsString({ message: 'Note must be a string' })
  note: string;

  @ApiProperty({
    description: 'Usage instructions: dosage, frequency, and duration',
    example: 'Take 2 tablets per dose, 3 times daily after meals, for 7 days',
  })
  @IsNotEmpty({ message: 'Checkout instructions are required' })
  @IsString({ message: 'Checkout instructions must be a string' })
  checkOut: string;
}
