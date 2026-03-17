import { ApiProperty } from '@nestjs/swagger';
import { ERMRecordType, ERMStatus } from '../enums';

/**
 * ERM Response DTO
 *
 * Response for ERM initialization (Step 3 - ERM Flow)
 */
export class ErmResponseDto {
  @ApiProperty({
    description: 'ERM ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  ermId: string;

  @ApiProperty({
    description: 'Service appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  serviceAppointmentId: string;

  @ApiProperty({
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'ERM record type',
    enum: ERMRecordType,
    example: ERMRecordType.CONSULTATION,
  })
  recordType: ERMRecordType;

  @ApiProperty({
    description: 'Service code',
    example: 'CONS001',
    nullable: true,
  })
  serviceCode: string | null;

  @ApiProperty({
    description: 'ERM status',
    enum: ERMStatus,
    example: ERMStatus.DRAFT,
  })
  status: ERMStatus;

  @ApiProperty({
    description: 'ID of the doctor who created this ERM',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  createdBy: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-02-24T09:00:00Z',
  })
  createdAt: Date;
}
