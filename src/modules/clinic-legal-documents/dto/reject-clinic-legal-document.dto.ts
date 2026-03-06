import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectClinicLegalDocumentDto {
  @ApiProperty({ description: 'Reason for rejecting the legal document' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}
