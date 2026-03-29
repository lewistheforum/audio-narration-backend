import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GetClinicDetailQueryDto {
  @ApiPropertyOptional({
    description: 'Search doctors in this clinic by full name or position',
    example: 'Nguyen',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  })
  @IsString()
  @MaxLength(255)
  doctorSearch?: string;
}
