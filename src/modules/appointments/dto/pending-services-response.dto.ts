import { ApiProperty } from '@nestjs/swagger';
import { ERMRecordType, ERMStatus } from '../../prescriptions/enums';

/**
 * Pending Service Item DTO
 *
 * Represents a service with ERM status information for Step 6
 */
export class PendingServiceItemDto {
  @ApiProperty({
    description: 'Service appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  serviceAppointmentId: string;

  @ApiProperty({
    description: 'Service name',
    example: 'Consultation',
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
    nullable: true,
  })
  ermId?: string | null;

  @ApiProperty({
    description: 'ERM status if exists',
    enum: ERMStatus,
    example: ERMStatus.IN_PROGRESS,
    required: false,
    nullable: true,
  })
  ermStatus?: ERMStatus | null;

  @ApiProperty({
    description: 'Service price',
    example: 500000,
  })
  price: number;

  @ApiProperty({
    description: 'Service discount',
    example: 50000,
    required: false,
  })
  discount?: number;
}

/**
 * Pending Services Response DTO
 *
 * Response for Step 6: Get pending, in-progress and completed services
 */
export class PendingServicesResponseDto {
  @ApiProperty({
    description: 'Services that do not have ERM yet',
    type: [PendingServiceItemDto],
    example: [
      {
        serviceAppointmentId: '123e4567-e89b-12d3-a456-426614174000',
        serviceName: 'Knee X-Ray',
        serviceType: 'XRAY',
        hasErm: false,
        ermId: null,
        ermStatus: null,
        price: 200000,
        discount: 20000,
      },
    ],
  })
  pendingServices: PendingServiceItemDto[];

  @ApiProperty({
    description:
      'Services that already have ERM but required fields are not fully filled',
    type: [PendingServiceItemDto],
    example: [
      {
        serviceAppointmentId: '123e4567-e89b-12d3-a456-426614174000',
        serviceName: 'Consultation',
        serviceType: 'CONSULTATION',
        hasErm: true,
        ermId: '123e4567-e89b-12d3-a456-426614174000',
        ermStatus: 'IN_PROGRESS',
        price: 500000,
        discount: 50000,
      },
    ],
  })
  inProgressServices: PendingServiceItemDto[];

  @ApiProperty({
    description: 'Services with ERM and all required fields filled',
    type: [PendingServiceItemDto],
    example: [
      {
        serviceAppointmentId: '123e4567-e89b-12d3-a456-426614174000',
        serviceName: 'Lab Test',
        serviceType: 'LAB',
        hasErm: true,
        ermId: '123e4567-e89b-12d3-a456-426614174000',
        ermStatus: 'IN_PROGRESS',
        price: 300000,
        discount: 0,
      },
    ],
  })
  completedServices: PendingServiceItemDto[];
}
