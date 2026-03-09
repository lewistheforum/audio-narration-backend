import { ApiProperty } from '@nestjs/swagger';

/**
 * Create Patient Account by Staff Response DTO
 * 
 * Response after successfully creating patient account via staff.
 * Includes account information and email sending status.
 */
export class CreatePatientByStaffResponseDto {
  @ApiProperty({
    description: 'Whether the operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Account ID (UUID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  accountId: string;

  @ApiProperty({
    description: 'Patient email address',
    example: 'nguyenthib@gmail.com',
  })
  email: string;

  @ApiProperty({
    description: 'Patient phone number',
    example: '0987654321',
  })
  phone: string;

  @ApiProperty({
    description: 'Patient full name',
    example: 'Nguyễn Thị B',
  })
  fullName: string;

  @ApiProperty({
    description: 'Auto-generated temporary password (shown only in response)',
    example: 'Ab12#xYz89!Q',
  })
  temporaryPassword: string;

  @ApiProperty({
    description: 'Whether email was sent successfully',
    example: true,
  })
  emailSent: boolean;

  @ApiProperty({
    description: 'Timestamp when email was sent',
    example: '2026-03-05T14:30:00Z',
    required: false,
  })
  emailSentAt?: string;

  @ApiProperty({
    description: 'Account activation status',
    example: 'PENDING_ACTIVATION',
    enum: ['PENDING_ACTIVATION', 'ACTIVE'],
  })
  activationStatus: string;

  @ApiProperty({
    description: 'Response message',
    example:
      'Tài khoản đã được tạo thành công. Email chứa mật khẩu đã được gửi đến nguyenthib@gmail.com',
  })
  message: string;
}
