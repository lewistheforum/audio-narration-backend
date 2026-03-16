import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AppointmentRepository } from './repositories/appointment.repository';
import { AppointmentPackageRepository } from './repositories/appointment-package.repository';
import { EmployeeScheduleRepository } from '../schedules/repositories/employee-schedule.repository';
import { formatToVietnamTime, formatToDateOnly } from '../../common/utils/date.util';

@Injectable()
export class AppointmentWebhookService {
  private readonly logger = new Logger(AppointmentWebhookService.name);
  private readonly webhookUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly appointmentRepo: AppointmentRepository,
    private readonly appointmentPackageRepo: AppointmentPackageRepository,
    private readonly employeeScheduleRepo: EmployeeScheduleRepository,
  ) {
    this.webhookUrl = this.configService.get<string>('N8N_APPOINTMENT_WEBHOOK_URL');
  }

  /**
   * Sends appointment confirmation to n8n webhook
   * @param appointmentId The ID of the confirmed appointment
   */
  async sendConfirmation(appointmentId: string): Promise<void> {
    if (!this.webhookUrl) {
      this.logger.warn('N8N_APPOINTMENT_WEBHOOK_URL is not configured');
      return;
    }

    try {
      this.logger.log(`Fetching details for appointment: ${appointmentId}`);
      
      // 1. Fetch basic appointment info with relations
      const appointment = await this.appointmentRepo.findByIdWithCompleteDetails(appointmentId);

      if (!appointment) {
        this.logger.error(`Appointment ${appointmentId} not found for webhook`);
        return;
      }

      // 2. Fetch services for this appointment
      const packages = await this.appointmentPackageRepo.findAllByAppointmentIdWithServices(appointmentId);
      const allServices: any[] = [];
      packages.forEach(pkg => {
        if (pkg.services) {
          allServices.push(...pkg.services);
        }
      });

      // 3. Fetch room info mapping
      let roomName = 'N/A';
      if (appointment.doctorId && appointment.appointmentDate && appointment.clinicShiftHourId) {
        const roomsMap = await this.employeeScheduleRepo.findClinicRoomsForMultipleAppointments([
          {
            appointmentId: appointment._id,
            clinicShiftHourId: appointment.clinicShiftHourId,
            doctorId: appointment.doctorId,
            appointmentDate: appointment.appointmentDate,
          }
        ]);
        const rooms = roomsMap.get(appointment._id) || [];
        if (rooms.length > 0) {
          roomName = rooms[0].roomName;
        }
      }

      // 4. Resolve labels
      const patient = appointment.patient;
      const patientProfile = patient?.generalAccount;
      const clinic = appointment.clinic;
      const clinicAdminInfo = clinic?.clinicAdminInformation;
      const shiftHour = appointment.clinicShiftHour;

      // Map data to the requested payload structure
      const clinicAddress = clinic?.address;
      const fullClinicAddress = clinicAddress 
        ? `${clinicAddress.address}, ${clinicAddress.wardName}, ${clinicAddress.districtName}, ${clinicAddress.provinceName}`
        : clinic?.address_text || 'N/A';

      const payload = {
        patientName: patientProfile?.fullName || patient?.username || 'N/A',
        patientPhone: patient?.phone || 'N/A',
        appointmentDate: appointment.appointmentDate ? formatToDateOnly(appointment.appointmentDate) : 'N/A',
        appointmentTime: shiftHour?.startHour || 'N/A',
        clinicName: clinicAdminInfo?.clinicName || clinic?.username || 'N/A',
        clinicAddress: fullClinicAddress,
        clinicPhone: clinicAdminInfo?.clinicPhone || clinic?.phone || 'N/A',
        room: roomName,
        serviceName: allServices.map(s => s.service_name).filter(Boolean).join(', ') || 'N/A',
        total: Number(appointment.total || 0),
        appointmentId: appointment._id,
      };

      this.logger.log(`Sending webhook to n8n for appointment ${appointmentId}. Payload: ${JSON.stringify(payload, null, 2)}`);
      await firstValueFrom(this.httpService.post(this.webhookUrl, payload));
      this.logger.log(`Webhook sent successfully for appointment ${appointmentId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send appointment confirmation webhook: ${error.message}`,
        error.stack,
      );
    }
  }
}
