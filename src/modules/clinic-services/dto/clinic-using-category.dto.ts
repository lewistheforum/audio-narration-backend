import { ApiProperty } from '@nestjs/swagger';

export class ClinicUsingCategoryDto {
  @ApiProperty()
  clinicName: string;

  @ApiProperty()
  branchName: string;

  @ApiProperty()
  serviceName: string;

  @ApiProperty()
  serviceCode: string;

  @ApiProperty()
  categoryName: string;

  @ApiProperty()
  contactEmail: string;
}
