import { ApiProperty } from '@nestjs/swagger';
import { AppointmentPackageStatus, PaymentType } from '../enums';

/**
 * Service Item in Package DTO
 * 
 * Represents a single service within a payment package
 */
export class PackageServiceItemDto {
  @ApiProperty({
    description: 'Service appointment ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  serviceAppointmentId: string;

  @ApiProperty({
    description: 'Clinic service config ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  clinicServiceId: string;

  @ApiProperty({
    description: 'Service name',
    example: 'General Consultation',
  })
  serviceName: string;

  @ApiProperty({
    description: 'Service price (VNĐ)',
    example: 500000,
  })
  servicePrice: number;

  @ApiProperty({
    description: 'Service discount (VNĐ)',
    example: 50000,
    required: false,
  })
  serviceDiscount?: number;
}

/**
 * Single Payment Package DTO
 * 
 * Represents one payment package with its services
 */
export class AppointmentPackageItemDto {
  @ApiProperty({
    description: 'Package ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  packageId: string;

  @ApiProperty({
    description: 'Appointment ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'Payment transaction reference ID (null for COD or pending)',
    example: '550e8400-e29b-41d4-a716-446655440004',
    nullable: true,
  })
  paymentTransactionId: string | null;

  @ApiProperty({
    description: 'Package amount (VNĐ)',
    example: 800000,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment status',
    enum: AppointmentPackageStatus,
    example: AppointmentPackageStatus.PENDING_PAYMENT,
  })
  status: AppointmentPackageStatus;

  @ApiProperty({
    description: 'Payment type (online/cod)',
    enum: PaymentType,
    example: PaymentType.COD,
    nullable: true,
  })
  paymentType: PaymentType | null;

  @ApiProperty({
    description: 'Services included in this package',
    type: () => [PackageServiceItemDto],
    isArray: true,
  })
  services: PackageServiceItemDto[];
}

/**
 * Payment Summary DTO
 * 
 * Summary statistics of all packages
 */
export class PaymentSummaryDto {
  @ApiProperty({
    description: 'Total number of packages',
    example: 3,
  })
  totalPackages: number;

  @ApiProperty({
    description: 'Total amount across all packages (VNĐ)',
    example: 1500000,
  })
  totalAmount: number;

  @ApiProperty({
    description: 'Total amount already paid (VNĐ)',
    example: 800000,
  })
  paidAmount: number;

  @ApiProperty({
    description: 'Total amount pending payment (VNĐ)',
    example: 700000,
  })
  pendingAmount: number;

  @ApiProperty({
    description: 'Number of packages paid',
    example: 1,
  })
  paidPackages: number;

  @ApiProperty({
    description: 'Number of packages pending',
    example: 2,
  })
  pendingPackages: number;
}

/**
 * Get Appointment Packages Response DTO
 * 
 * Main response for GET /appointments/:id/packages
 */
export class GetAppointmentPackagesResponseDto {
  @ApiProperty({
    description: 'Appointment ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'List of payment packages',
    type: () => [AppointmentPackageItemDto],
    isArray: true,
  })
  packages: AppointmentPackageItemDto[];

  @ApiProperty({
    description: 'Payment summary',
    type: () => PaymentSummaryDto,
  })
  summary: PaymentSummaryDto;
}
