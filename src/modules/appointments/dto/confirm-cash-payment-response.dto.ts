import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { AppointmentPackageStatus, PaymentType, AppointmentStatus } from '../enums';
import { formatToVietnamTime } from '../../../common/utils/date.util';

/**
 * Package Details in Confirm Response DTO
 * 
 * Details of the package that was just confirmed
 */
export class ConfirmedPackageDetailsDto {
  @ApiProperty({
    description: 'Package ID that was confirmed',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  packageId: string;

  @ApiProperty({
    description: 'Package amount (VNĐ)',
    example: 700000,
  })
  amount: number;

  @ApiProperty({
    description: 'Payment status (should be "paid" after confirmation)',
    enum: AppointmentPackageStatus,
    example: AppointmentPackageStatus.PAID,
  })
  status: AppointmentPackageStatus;

  @ApiProperty({
    description: 'Payment type (should be "cod" after cash confirmation)',
    enum: PaymentType,
    example: PaymentType.COD,
  })
  paymentType: PaymentType;

  @ApiProperty({
    description: 'Payment transaction reference (null for COD)',
    example: null,
    nullable: true,
  })
  paymentTransactionId: null;

  @ApiProperty({
    description: 'Package updated timestamp',
    example: '2026-03-08T14:30:00Z',
  })
  @Transform(({ value }) => formatToVietnamTime(value))
  updatedAt: Date;
}

/**
 * Confirm Cash Payment Response DTO
 * 
 * Response after confirming cash payment for a specific package
 */
export class ConfirmCashPaymentResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Xác nhận thanh toán tiền mặt thành công',
  })
  message: string;

  @ApiProperty({
    description: 'Appointment ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'Details of the confirmed package',
    type: () => ConfirmedPackageDetailsDto,
  })
  package: ConfirmedPackageDetailsDto;

  @ApiProperty({
    description: 'Current appointment status',
    enum: AppointmentStatus,
    example: AppointmentStatus.COMPLETED,
  })
  appointmentStatus: AppointmentStatus;

  @ApiProperty({
    description: 'Whether all packages of this appointment are now paid',
    example: true,
  })
  allPackagesPaid: boolean;

  @ApiProperty({
    description: 'Number of packages still pending payment',
    example: 0,
  })
  remainingPendingPackages: number;
}
