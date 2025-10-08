import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdatePasswordDto {
  @ApiProperty({
    description: 'The current password of the user',
    example: 'currentPassword123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  oldPassword: string;

  @ApiProperty({
    description: 'The new password for the user',
    example: 'newStrongPassword456',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}