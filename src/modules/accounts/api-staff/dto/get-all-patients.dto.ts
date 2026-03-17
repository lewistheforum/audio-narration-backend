import { ApiProperty } from '@nestjs/swagger';

export class PatientAccountDto {
  @ApiProperty()
  accountId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ required: false })
  dateOfBirth?: string;

  @ApiProperty({ required: false })
  gender?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isTempEmail: boolean;
}

export class GetAllPatientsResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ type: [PatientAccountDto] })
  data: PatientAccountDto[];

  @ApiProperty()
  total: number;
}
