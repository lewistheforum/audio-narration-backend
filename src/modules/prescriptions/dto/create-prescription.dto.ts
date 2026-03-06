import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { MedicineItemDto } from './medicine-item.dto';

/**
 * Create Prescription DTO (Step 7)
 *
 * Used for creating or updating electronic prescription
 */
export class CreatePrescriptionDto {
  @ApiProperty({
    description: 'General notes from doctor',
    example: 'Uống đủ nước, tránh rượu bia trong thời gian dùng thuốc',
    required: false,
  })
  @IsOptional()
  @IsString()
  doctorNote?: string;

  @ApiProperty({
    description: 'List of medicines with usage instructions',
    type: [MedicineItemDto],
    example: [
      {
        medicineId: '123e4567-e89b-12d3-a456-426614174000',
        checkOut: 'Uống 2 viên/lần, ngày 3 lần, sau ăn. Dùng trong 7 ngày',
      },
      {
        medicineId: '123e4567-e89b-12d3-a456-426614174001',
        checkOut: 'Bôi vùng da bị viêm, ngày 2 lần sau khi vệ sinh',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one medicine is required' })
  @ValidateNested({ each: true })
  @Type(() => MedicineItemDto)
  medicines: MedicineItemDto[];
}
