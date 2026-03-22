import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteExaminationDto {
  @ApiPropertyOptional({
    description: 'Final diagnosis from doctor after examination',
    example: 'Acute pharyngitis. Patient requires rest and medication as prescribed.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnosis?: string;
}
