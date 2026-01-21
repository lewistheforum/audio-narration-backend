import { ApiProperty } from '@nestjs/swagger';

/**
 * Subscription Service Response DTO
 *
 * Data transfer object for subscription service responses.
 * Contains all fields required for the Pricing screen UI.
 */
export class SubscriptionServiceResponseDto {
  @ApiProperty({
    description: 'Subscription service ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Service name',
    example: 'Basic Plan',
  })
  serviceName: string;

  @ApiProperty({
    description: 'Service code',
    example: 'BASIC',
  })
  code: string;

  @ApiProperty({
    description: 'Service description',
    example: 'Basic subscription plan for small clinics',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Service price',
    example: 500000,
  })
  price: number;

  @ApiProperty({
    description: 'Discount percentage',
    example: 10,
  })
  discount: number;

  @ApiProperty({
    description: 'List of service functions/features',
    example: ['Appointment Management', 'Patient Records'],
    required: false,
    type: [String],
  })
  serviceFunctions?: string[];

  @ApiProperty({
    description: 'Whether this service is popular',
    example: true,
  })
  isPopular: boolean;

  @ApiProperty({
    description: 'Chart color for UI display',
    example: '#3B82F6',
    required: false,
  })
  chartColor?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Price after discount calculation',
    example: 450000,
  })
  priceAfterDiscount: number;
}
