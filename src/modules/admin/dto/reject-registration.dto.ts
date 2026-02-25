import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Reject Registration DTO
 *
 * Request body for rejecting a registration
 */
export class RejectRegistrationDto {
  @ApiProperty({
    description: 'Lý do từ chối (phải đủ chi tiết để user hiểu và sửa)',
    example: 'Giấy phép kinh doanh đã hết hạn. Vui lòng upload bản mới có hiệu lực.',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Lý do từ chối không được để trống' })
  @MinLength(10, { message: 'Lý do từ chối phải có ít nhất 10 ký tự' })
  @MaxLength(1000, { message: 'Lý do từ chối không được vượt quá 1000 ký tự' })
  reason: string;
}
