import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { SubscriptionServiceStatus } from '../enums/subscription-service-status.enum';

export class CreateSubscriptionServiceDto {
  @ApiProperty({
    description: 'Service name',
    example: 'Basic Plan',
  })
  @IsNotEmpty()
  @IsString()
  serviceName: string;

  @ApiProperty({
    description: 'Service code',
    example: 'BASIC',
  })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({
    description: 'Service description',
    example: 'Basic subscription plan for small clinics',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Service price',
    example: 500000,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({
    description: 'Discount percentage (0-100)',
    example: 10,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;

  @ApiProperty({
    description: 'List of service functions/features',
    example: ['Appointment Management', 'Patient Records'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceFunctions?: string[];

  @ApiProperty({
    description: 'Whether this service is popular',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @ApiProperty({
    description: 'Service status',
    enum: SubscriptionServiceStatus,
    example: SubscriptionServiceStatus.ACTIVE,
    default: SubscriptionServiceStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SubscriptionServiceStatus)
  status?: SubscriptionServiceStatus;

  @ApiProperty({
    description: 'Chart color for UI display',
    example: '#3B82F6',
    required: false,
  })
  @IsOptional()
  @IsString()
  chartColor?: string;
}
