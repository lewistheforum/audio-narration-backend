import { ApiProperty } from '@nestjs/swagger';

/**
 * Send Reminder Response DTO
 */
export class SendReminderResponseDto {
  @ApiProperty({
    description: 'Whether the email was sent successfully',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Appointment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  appointment_id: string;

  @ApiProperty({
    description: 'Patient email address',
    example: 'patient@example.com',
  })
  patient_email: string;

  @ApiProperty({
    description: 'Timestamp when email was sent',
    example: '2026-03-05T10:30:00Z',
  })
  sent_at: string;

  @ApiProperty({
    description: 'Success message',
    example: 'Reminder email sent successfully',
  })
  message: string;
}
