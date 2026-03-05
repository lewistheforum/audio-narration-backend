import { ApiProperty } from '@nestjs/swagger';
import { ERMRecordType } from '../../prescriptions/enums/erm-enums';

export class AddServiceResponseDto {
  @ApiProperty({
    description: 'ID of the appointment package created',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  appointmentPackageId: string;

  @ApiProperty({
    description: 'ID of the service appointment created',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  serviceAppointmentId: string;

  @ApiProperty({
    description: 'ID of the appointment',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'ID of the clinic service',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  clinicServiceId: string;

  @ApiProperty({
    description: 'Name of the service',
    example: 'X-ray Chest',
  })
  serviceName: string;

  @ApiProperty({
    description: 'Type of the service',
    enum: ERMRecordType,
    example: ERMRecordType.XRAY,
  })
  serviceType: ERMRecordType;

  @ApiProperty({
    description: 'Price of the service',
    example: 200000,
  })
  price: number;

  @ApiProperty({
    description: 'Flag indicating service was added during examination',
    example: true,
  })
  addedDuringExamination: boolean;

  @ApiProperty({
    description: 'ID of the doctor who added the service',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  addedBy: string;

  @ApiProperty({
    description: 'Timestamp when service was added',
    example: '2026-03-02T10:30:00Z',
  })
  createdAt: Date;
}
