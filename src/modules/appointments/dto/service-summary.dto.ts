import { ApiProperty } from '@nestjs/swagger';
import { ERMRecordType } from '../../prescriptions/enums';

/**
 * Service Summary DTO
 *
 * Represents a service in an appointment with ERM status
 */
export class ServiceSummaryDto {
  @ApiProperty({
    description: 'Service appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  serviceAppointmentId: string;

  @ApiProperty({
    description: 'Clinic service ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  clinicServiceId: string;

  @ApiProperty({
    description: 'Service name',
    example: 'Khám tư vấn',
  })
  serviceName: string;

  @ApiProperty({
    description: 'Service type/category',
    enum: ERMRecordType,
    example: ERMRecordType.CONSULTATION,
  })
  serviceType: ERMRecordType;

  @ApiProperty({
    description: 'Whether this service has an ERM record',
    example: false,
  })
  hasErm: boolean;

  @ApiProperty({
    description: 'ERM ID if exists',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  ermId?: string;
}
