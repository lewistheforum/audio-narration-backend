import { ApiProperty } from '@nestjs/swagger';

export class DeleteSuccessResponseDto {
  @ApiProperty({ example: 'User deleted successfully.' })
  message: string;
}