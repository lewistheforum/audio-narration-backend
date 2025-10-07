import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

export class UserSuccessResponseDto {
  @ApiProperty({ type: UserResponseDto })
  data: UserResponseDto;

  @ApiProperty({ example: 'User created successfully.' })
  message: string;
}