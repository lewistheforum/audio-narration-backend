import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CompleteExaminationDto {
  @ApiProperty({
    description: 'Final diagnosis from doctor after examination',
    example: 'Acute pharyngitis. Patient requires rest and medication as prescribed.',
    maxLength: 2000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  diagnosis: string;
}
