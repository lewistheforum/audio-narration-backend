import { ApiProperty } from '@nestjs/swagger';
import { AppointmentResponseDto } from './appointment-response.dto';

/**
 * Doctor Appointments List Response DTO
 *
 * Wrapper for doctor's appointment list with comprehensive appointment data
 */
export class DoctorAppointmentsResponseDto {
  @ApiProperty({
    type: [AppointmentResponseDto],
    description: 'List of appointments with full patient, doctor, service, and clinic room details',
  })
  appointments: AppointmentResponseDto[];
}
