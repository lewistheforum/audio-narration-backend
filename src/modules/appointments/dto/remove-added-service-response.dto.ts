import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { formatToVietnamTime } from '../../../common/utils/date.util';

export class RemoveAddedServiceResponseDto {
  @ApiProperty({
    description: 'ID of the appointment',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'ID of the removed service appointment',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  serviceAppointmentId: string;

  @ApiProperty({
    description: 'ID of the payment package containing the removed service',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  appointmentPackageId: string;

  @ApiProperty({
    description: 'ID of the clinic service removed from appointment',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  clinicServiceId: string;

  @ApiProperty({
    description: 'Name of the removed service',
    example: 'X-ray Chest',
  })
  serviceName: string;

  @ApiProperty({
    description: 'Amount previously charged for this package',
    example: 180000,
  })
  amount: number;

  @ApiProperty({
    description: 'Whether payment package was also removed because it has no remaining services',
    example: true,
  })
  packageRemoved: boolean;

  @ApiProperty({
    description: 'Doctor account ID who removed the service',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  removedBy: string;

  @ApiProperty({
    description: 'Timestamp when the service was removed',
    example: '2026-03-16T10:30:00Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  removedAt: Date;
}