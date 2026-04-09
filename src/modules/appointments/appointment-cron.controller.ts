import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppointmentCronService } from './appointment-cron.service';

@ApiTags('Appointment Reminders (Internal)')
@Controller('appointments/reminders')
export class AppointmentCronController {
  constructor(private readonly appointmentCronService: AppointmentCronService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger appointment reminders' })
  @ApiResponse({ status: 200, description: 'Reminders processed successfully' })
  async triggerReminders() {
    return await this.appointmentCronService.processReminders();
  }

  @Post('trigger-auto-cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger auto-cancel of expired appointments' })
  @ApiResponse({ status: 200, description: 'Auto-cancel processed successfully' })
  async triggerAutoCancel() {
    const affected = await this.appointmentCronService.handleAutoCancelExpiredAppointments();
    return {
      message: 'Auto-cancel processed successfully',
      affected_appointments: affected,
    };
  }
}
