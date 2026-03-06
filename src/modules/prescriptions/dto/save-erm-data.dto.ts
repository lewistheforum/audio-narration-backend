import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Save ERM Data DTO
 * Wrapper DTO for saving ERM data of any type
 */
export class SaveErmDataDto {
  @ApiProperty({
    description: 'ERM data based on record type',
    type: Object,
    example: {
      visitType: 'FIRST_VISIT',
      chiefComplaint: 'Đau khớp gối trái',
      painIntensity: 6,
    },
  })
  @IsNotEmpty()
  data: any;
}
