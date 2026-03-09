import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayMaxSize, ArrayMinSize } from 'class-validator';

/**
 * Send Reminder Bulk Request DTO
 */
export class SendReminderBulkDto {
  @ApiProperty({
    description: 'Array of appointment IDs (max 100)',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001',
    ],
    type: [String],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Phải có ít nhất 1 appointment' })
  @ArrayMaxSize(100, { message: 'Tối đa 100 appointments mỗi lần gửi' })
  @IsUUID('4', { each: true, message: 'Mỗi appointment_id phải là UUID hợp lệ' })
  appointment_ids: string[];
}

/**
 * Send Reminder Bulk Response DTO
 */
export class SendReminderBulkResponseDto {
  @ApiProperty({
    description: 'Total number of appointments requested',
    example: 10,
  })
  total_requested: number;

  @ApiProperty({
    description: 'Number of emails sent successfully',
    example: 8,
  })
  total_sent: number;

  @ApiProperty({
    description: 'Number of emails failed',
    example: 1,
  })
  total_failed: number;

  @ApiProperty({
    description: 'Number of appointments skipped',
    example: 1,
  })
  total_skipped: number;

  @ApiProperty({
    description: 'Timestamp when bulk send was initiated',
    example: '2026-03-05T10:30:00Z',
  })
  sent_at: string;

  @ApiProperty({
    description: 'Summary message',
    example: 'Đã gửi 8/10 email thành công',
  })
  message: string;
}
