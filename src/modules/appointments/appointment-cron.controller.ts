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
}
