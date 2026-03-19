import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentRepository } from './repositories/appointment.repository';
import { MailerService } from '../mailer/mailer.service';

@Injectable()
export class AppointmentCronService {
  private readonly logger = new Logger(AppointmentCronService.name);

  constructor(
    private readonly appointmentRepository: AppointmentRepository,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Cron job that runs every 12 hours to check for appointments needing reminders.
   * Vietnam timezone (Asia/Ho_Chi_Minh)
   */
  @Cron(CronExpression.EVERY_12_HOURS, {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleAppointmentReminders() {
    this.logger.log('⏰ Starting Appointment Reminder Cron Job...');
    try {
      await this.processReminders();
    } catch (error) {
      this.logger.error('❌ Appointment Reminder Cron Job failed', error.stack);
    }
  }

  /**
   * Logic to fetch and send reminders.
   * Can be triggered manually for testing.
   */
  async processReminders(): Promise<{ processed: number; success: number; failed: number }> {
    const appointments = await this.appointmentRepository.findAppointmentsNeedingReminder();
    
    if (!appointments || appointments.length === 0) {
      this.logger.log('No appointments needing reminder found.');
      return { processed: 0, success: 0, failed: 0 };
    }

    this.logger.log(`Found ${appointments.length} appointments to remind. Sample data: ${JSON.stringify(appointments[0]).substring(0, 200)}...`);
    
    let successCount = 0;
    let failedCount = 0;

    // Bulk processing using Promise.allSettled for reliability and performance
    const reminderPromises = appointments.map(async (appointment) => {
      try {
        await this.sendEmail(appointment);
        // User requested NOT to update is_remider column
        // await this.appointmentRepository.markAsReminded(appointment.appointment_id);
        successCount++;
      } catch (error) {
        failedCount++;
        this.logger.error(
          `Failed to send reminder for appointment ${appointment.appointment_id}: ${error.message}`,
        );
      }
    });

    await Promise.allSettled(reminderPromises);

    this.logger.log(
      `✅ Bulk processing complete. Success: ${successCount}, Failed: ${failedCount}`,
    );

    return {
      processed: appointments.length,
      success: successCount,
      failed: failedCount,
    };
  }

  private async sendEmail(appointment: any): Promise<void> {
    // Detailed logging of raw data to debug mapping
    const rawKeys = Object.keys(appointment);
    this.logger.debug(`Mapping appointment ${appointment.appointment_id}. Keys: ${rawKeys.join(', ')}`);

    const {
      patient_email,
      patient_name,
      clinic_name,
      appointment_date,
      appointment_hour,
      address,
      ward_name,
      district_name,
      province_name,
      manager_phone,
      clinic_admin_phone,
      doctor_name,
      service_names,
    } = appointment;

    if (!patient_email || patient_email === 'null') {
      this.logger.warn(`Skipping appointment ${appointment.appointment_id} - Invalid email: ${patient_email}`);
      return;
    }

    // Build address robustly
    const addressParts = [address, ward_name, district_name, province_name].filter(
      (part) => part && part !== 'null' && String(part).trim() !== '',
    );
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : 'Địa chỉ đang cập nhật';
    
    const contactPhone = clinic_admin_phone || manager_phone || 'N/A';

    // Format date and hour
    const formattedDate = appointment_date ? new Date(appointment_date).toLocaleDateString('vi-VN') : 'N/A';
    const formattedHour = appointment_hour 
      ? new Date(appointment_hour).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : 'N/A';

    // Handle doctor name (SQL now provides 'Bác sĩ trực' as COALESCE fallback)
    const finalDoctorName = (doctor_name && doctor_name !== 'null') 
      ? String(doctor_name) 
      : 'Bác sĩ trực';

    // Handle service names
    const services = (service_names && service_names !== 'null')
      ? String(service_names).split(', ').map((name: string) => ({
          serviceName: name,
          serviceType: 'Dịch vụ y tế',
        }))
      : [];

    this.logger.log(`📧 Sending reminder to ${patient_email}: Doctor="${finalDoctorName}", ServicesCount=${services.length}, Address="${fullAddress}"`);

    await this.mailerService.sendAppointmentReminderEmail(
      patient_email,
      {
        patientName: patient_name && patient_name !== 'null' ? patient_name : 'Quý khách',
        clinicName: clinic_name && clinic_name !== 'null' ? clinic_name : 'Medicare Clinic',
        clinicAddress: fullAddress,
        clinicPhone: contactPhone,
        appointmentDate: formattedDate,
        appointmentHour: formattedHour,
        doctorName: finalDoctorName,
        services: services,
      },
    );
  }
}
