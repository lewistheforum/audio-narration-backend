import { ApiProperty } from '@nestjs/swagger';
import { ClientResponseDto } from '../../client/dto/client-response.dto';

/**
 * Login Response Data Transfer Object
 * 
 * Returned after successful authentication (login or OAuth)
 * Contains JWT token and complete user information
 */
export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT Access Token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'User ID',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  userId: string;

  @ApiProperty({
    description: 'User information',
    type: ClientResponseDto,
    required: false,
  })
  user?: ClientResponseDto;
}
