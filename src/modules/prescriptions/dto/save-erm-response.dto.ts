import { ApiProperty } from '@nestjs/swagger';

/**
 * Save ERM Response DTO
 * Response after successfully saving ERM data
 */
export class SaveErmResponseDto {
  @ApiProperty({ example: 'erm1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  ermId: string;

  @ApiProperty({ example: 'IN_PROGRESS' })
  status: string;

  @ApiProperty({ example: '2026-02-24T10:30:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: 'Đã lưu thông tin ERM thành công' })
  message: string;
}
