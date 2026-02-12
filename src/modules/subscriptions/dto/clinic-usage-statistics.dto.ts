import { ApiProperty } from '@nestjs/swagger';

export class ClinicUsageStatisticsDto {
  @ApiProperty({ example: 'Main Clinic', description: 'Name of the clinic' })
  clinicName: string;

  @ApiProperty({ example: 'Branch A', description: 'Name of the clinic branch' })
  branchName: string;

  @ApiProperty({ example: 5, description: 'Number of appointments' })
  appointmentCount: number;
}
