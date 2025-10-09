import { ApiProperty } from '@nestjs/swagger';

export class SendMailDataDto {
  @ApiProperty({
    description: 'Array of email addresses that accepted the message.',
    example: ['test@example.com'],
    type: [String],
  })
  accepted: string[];

  @ApiProperty({
    description: 'Array of email addresses that rejected the message.',
    example: [],
    type: [String],
  })
  rejected: string[];

  @ApiProperty({
    description: 'The unique message ID of the sent email.',
    example: '<c1a2b3d4-e5f6-7890-1234-567890abcdef@example.com>',
    type: String,
  })
  messageId: string;
}