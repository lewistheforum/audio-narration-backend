import { ApiProperty } from '@nestjs/swagger';

/**
 * Create Patient Account Without Email Response DTO
 * 
 * Response after successfully creating patient account without real email.
 * Includes auto-generated fake email and password for manual delivery.
 */
export class CreatePatientNoEmailResponseDto {
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
    description: 'Auto-generated fake email (name + DOB + @tempemail.clinic)',
    example: 'tranvand10081988@tempemail.clinic',
  })
  email: string;

  @ApiProperty({
    description: 'Flag indicating this is a temporary/fake email',
    example: true,
  })
  isTempEmail: boolean;

  @ApiProperty({
    description: 'Patient phone number',
    example: '0976543210',
  })
  phone: string;

  @ApiProperty({
    description: 'Patient full name',
    example: 'Trần Văn D',
  })
  fullName: string;

  @ApiProperty({
    description: 'Patient date of birth',
    example: '1988-08-10',
  })
  dateOfBirth: string;

  @ApiProperty({
    description: 'Auto-generated temporary password (shown only in response)',
    example: 'Cd34#aWq12!T',
  })
  temporaryPassword: string;

  @ApiProperty({
    description: 'Email sent status',
    example: true,
  })
  emailSent: boolean;

  @ApiProperty({
    description: 'Timestamp when the email was sent',
    example: '2025-03-10T15:30:00Z',
    required: false,
  })
  emailSentAt?: string;

  @ApiProperty({
    description: 'Account activation status',
    example: 'ACTIVE',
    enum: ['ACTIVE'],
  })
  activationStatus: string;

  @ApiProperty({
    description: 'Response message',
    example:
      'Account created successfully with temporary email. Customer can update real email later.',
  })
  message: string;

  @ApiProperty({
    description: 'Instructions for staff to provide credentials manually',
    example: {
      username: 'tranvand10081988@tempemail.clinic',
      password: 'Cd34#aWq12!T',
      instructions: 'Please provide this login information to the customer directly',
    },
  })
  manualLoginInfo: {
    username: string;
    password: string;
    instructions: string;
  };
}
