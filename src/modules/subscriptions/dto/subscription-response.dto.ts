import { ApiProperty } from '@nestjs/swagger';
import { RegistrationStatus } from '../enums';

/**
 * Subscription Response DTO
 *
 * Data transfer object for current clinic subscription response.
 * Returns current subscription with service details.
 */
export class SubscriptionResponseDto {
  @ApiProperty({
    description: 'Subscription ID',
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
    example: 'Premium Plan',
  })
  serviceName: string;

  @ApiProperty({
    description: 'Service code',
    example: 'PREMIUM',
  })
  serviceCode: string;

  @ApiProperty({
    description: 'Service description',
    example: 'Premium subscription plan with all features',
    required: false,
  })
  serviceDescription?: string;

  @ApiProperty({
    description: 'Service price',
    example: 1000000,
  })
  servicePrice: number;

  @ApiProperty({
    description: 'Discount percentage',
    example: 15,
  })
  serviceDiscount: number;

  @ApiProperty({
    description: 'Price after discount calculation',
    example: 850000,
  })
  servicePriceAfterDiscount: number;

  @ApiProperty({
    description: 'List of service functions/features',
    example: ['Advanced Analytics', 'Priority Support', 'Custom Branding'],
    required: false,
    type: [String],
  })
  serviceFunctions?: string[];

  @ApiProperty({
    description: 'Subscription start date',
    example: '2024-01-01T00:00:00.000Z',
  })
  subscriptionDate: Date;

  @ApiProperty({
    description: 'Subscription expiration date',
    example: '2025-01-01T00:00:00.000Z',
  })
  expirationDate: Date;

  @ApiProperty({
    description: 'Subscription status',
    enum: RegistrationStatus,
    example: RegistrationStatus.ACTIVE,
  })
  subscriptionStatus: RegistrationStatus;

  @ApiProperty({
    description: 'Subscription creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}
