import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

/**
 * Update Manager Location DTO
 * Used for PATCH /api/clinic-managers/:id/location
 * Updates address and Google Maps iframe
 */
export class UpdateManagerLocationDto {
  @ApiProperty({ description: 'Street address' })
  @IsString()
  address: string;

  @ApiProperty({ description: 'Ward code' })
  @IsString()
  ward: string;

  @ApiProperty({ description: 'District code' })
  @IsString()
  district: string;

  @ApiProperty({ description: 'Province code' })
  @IsString()
  province: string;

  @ApiProperty({ description: 'Province name' })
  @IsString()
  provinceName: string;

  @ApiProperty({ description: 'District name' })
  @IsString()
  districtName: string;

  @ApiProperty({ description: 'Ward name' })
  @IsString()
  wardName: string;

  @ApiPropertyOptional({ description: 'Google Maps iframe HTML' })
  @IsOptional()
  @IsString()
  googleMapIframe?: string;
}
