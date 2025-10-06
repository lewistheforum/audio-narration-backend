import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMailerDto {
  @ApiProperty({
    description: 'Target mail',
    example: 'test@example.com',
  })
  @IsEmail()
  targetMail: string;
}
