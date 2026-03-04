import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

/**
 * Medicine Item DTO
 *
 * Represents a medicine in a prescription with usage instructions
 */
export class MedicineItemDto {
  @ApiProperty({
    description: 'Medicine ID from medicines table',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID('4')
  medicineId: string;

  @ApiProperty({
    description: 'Usage instructions (dosage, frequency, duration)',
    example: 'Uống 2 viên/lần, ngày 3 lần, sau ăn. Dùng trong 7 ngày',
  })
  @IsNotEmpty()
  @IsString()
  checkOut: string;
}
