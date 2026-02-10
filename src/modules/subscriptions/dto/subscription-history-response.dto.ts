import { ApiProperty } from '@nestjs/swagger';
import { RegistrationStatus } from '../enums';

/**
 * Subscription History Item DTO
 *
 * Individual history record in subscription history.
 */
export class SubscriptionHistoryItemDto {
  @ApiProperty({
    description: 'History record ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Clinic account ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  clinicId: string;

  @ApiProperty({
    description: 'Service ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  serviceId: string;

  @ApiProperty({
    description: 'Service name',
    example: 'Basic Plan',
  })
  serviceName: string;

  @ApiProperty({
    description: 'Service code',
    example: 'BASIC',
  })
  serviceCode: string;

  @ApiProperty({
    description: 'Service description',
    example: 'Basic subscription plan',
    required: false,
  })
  serviceDescription?: string;

  @ApiProperty({
    description: 'Service price at time of subscription',
    example: 500000,
  })
  servicePrice: number;

  @ApiProperty({
    description: 'Discount percentage applied',
    example: 10,
  })
  serviceDiscount: number;

  @ApiProperty({
    description: 'Price after discount',
    example: 450000,
  })
  servicePriceAfterDiscount: number;

  @ApiProperty({
    description: 'List of service functions/features',
    example: ['Basic Analytics', 'Standard Support'],
    required: false,
    type: [String],
  })
  serviceFunctions?: string[];

  @ApiProperty({
    description: 'Subscription start date',
    example: '2023-01-01T00:00:00.000Z',
  })
  subscriptionDate: Date;

  @ApiProperty({
    description: 'Subscription expiration date',
    example: '2024-01-01T00:00:00.000Z',
  })
  expirationDate: Date;

  @ApiProperty({
    description: 'Subscription status',
    enum: RegistrationStatus,
    example: RegistrationStatus.EXPIRED,
  })
  subscriptionStatus: RegistrationStatus;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt: Date;
}

/**
 * Subscription History Response DTO
 *
 * Paginated response for subscription history.
 */
export class SubscriptionHistoryResponseDto {
  @ApiProperty({
    description: 'Array of subscription history records',
    type: [SubscriptionHistoryItemDto],
  })
  data: SubscriptionHistoryItemDto[];

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of records per page',
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of records',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages: number;
}
