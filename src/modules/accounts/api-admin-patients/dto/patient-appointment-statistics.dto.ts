import { ApiProperty } from '@nestjs/swagger';

export class ClinicAppointmentDetailDto {
  @ApiProperty({ example: 'CarePlus' })
  clinicAdminName: string;

  @ApiProperty({ example: 'District 1 Branch' })
  branchName: string;

  @ApiProperty({ example: 5 })
  appointmentCount: number;

  @ApiProperty({ example: '2023-10-27T10:00:00Z' })
  latestAppointmentDate: Date;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  clinicId: string;
}

export class PatientAppointmentStatisticsDto {
  @ApiProperty({ example: 3 })
  totalClinics: number;

  @ApiProperty({ type: [ClinicAppointmentDetailDto] })
  details: ClinicAppointmentDetailDto[];
}
