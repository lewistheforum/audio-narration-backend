import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { formatToVietnamTime } from '../../../common/utils/date.util';

/**
 * Prescription Medicine Detail DTO
 *
 * Represents a medicine in prescription response with full details
 */
export class PrescriptionMedicineDetailDto {
  @ApiProperty({
    description: 'Detail prescription ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  detailId: string;

  @ApiProperty({
    description: 'Medicine ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  medicineId: string;

  @ApiProperty({
    description: 'Medicine name',
    example: 'Paracetamol 500mg',
  })
  medicineName: string;

  @ApiProperty({
    description: 'Whether medicine is habit-forming',
    example: false,
  })
  habitForming: boolean;

  @ApiProperty({
    description: 'Quantity of medicines',
    example: '10',
  })
  quantity: number;

  @ApiProperty({
    description: 'Usage instructions',
    example: 'Uống 2 viên/lần, ngày 3 lần, sau ăn. Dùng trong 7 ngày',
  })
  note: string;

  @ApiProperty({
    description: 'Usage instructions',
    example: 'Uống 2 viên/lần, ngày 3 lần, sau ăn. Dùng trong 7 ngày',
  })
  checkOut: string;
}

/**
 * Prescription Response DTO (Step 7)
 *
 * Response for created/updated prescription
 */
export class PrescriptionResponseDto {
  @ApiProperty({
    description: 'E-Prescription ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  ePrescriptionId: string;

  @ApiProperty({
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'Unique reference ID for the prescription',
    example: 'EP20260224001',
  })
  referenceId: string;

  @ApiProperty({
    description: 'General notes from doctor',
    example: 'Uống đủ nước, tránh rượu bia',
    required: false,
  })
  doctorNote?: string;

  @ApiProperty({
    description: 'List of medicines with details',
    type: [PrescriptionMedicineDetailDto],
  })
  medicines: PrescriptionMedicineDetailDto[];

  @ApiProperty({
    description: 'Whether prescription has habit-forming medicines',
    example: false,
  })
  hasHabitFormingMedicines: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-02-24T10:30:00Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-02-24T10:30:00Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  updatedAt: Date;
}
