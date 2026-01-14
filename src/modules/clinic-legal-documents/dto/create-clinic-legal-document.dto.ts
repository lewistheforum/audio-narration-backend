import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateClinicLegalDocumentDto {
  @ApiProperty({ description: 'Account identifier owning the clinic document' })
  @IsUUID()
  accountId: string;

  @ApiProperty({ description: 'Operating license file/url', required: false })
  @IsOptional()
  @IsString()
  operatingLicense?: string;

  @ApiProperty({ description: 'Business license file/url', required: false })
  @IsOptional()
  @IsString()
  businessLicense?: string;
 }
