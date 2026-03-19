import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentCronService } from '../../../src/modules/appointments/appointment-cron.service';
import { AppointmentRepository } from '../../../src/modules/appointments/repositories/appointment.repository';
import { MailerService } from '../../../src/modules/mailer/mailer.service';
import { Logger } from '@nestjs/common';

describe('AppointmentCronService (V6.2) - Unit Tests', () => {
  let service: AppointmentCronService;
  let repository: AppointmentRepository;
  let mailerService: MailerService;

  const mockAppointment = {
    appointment_id: 'app-1',
    patient_email: 'patient@example.com',
    patient_name: 'John Doe',
    clinic_name: 'Medicare Clinic - Hai Phong Branch',
    appointment_date: '2026-03-20',
    appointment_hour: '2026-03-20T10:00:00Z',
    address: '123 Street',
    ward_name: 'Ward 1',
    district_name: 'District 1',
    province_name: 'Province 1',
    manager_phone: '0123456789',
    clinic_admin_phone: '0987654321',
    doctor_name: 'Dr. Smith',
    service_names: 'Service A, Service B',
  };

  const mockRepo = {
    findAppointmentsNeedingReminder: jest.fn(),
    markAsReminded: jest.fn(),
  };

  const mockMailer = {
    sendAppointmentReminderEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentCronService,
        { provide: AppointmentRepository, useValue: mockRepo },
        { provide: MailerService, useValue: mockMailer },
      ],
    }).compile();

    service = module.get<AppointmentCronService>(AppointmentCronService);
    repository = module.get<AppointmentRepository>(AppointmentRepository);
    mailerService = module.get<MailerService>(MailerService);

    jest.clearAllMocks();
  });

  describe('processReminders', () => {
    it('TC-REM-01: should process reminders and call sendEmail', async () => {
      mockRepo.findAppointmentsNeedingReminder.mockResolvedValue([mockAppointment]);
      mockMailer.sendAppointmentReminderEmail.mockResolvedValue(undefined);

      const result = await service.processReminders();

      expect(result.processed).toBe(1);
      expect(result.success).toBe(1);
      expect(mockMailer.sendAppointmentReminderEmail).toHaveBeenCalled();
    });

    it('TC-REM-02: should NOT call markAsReminded (as per user request)', async () => {
      mockRepo.findAppointmentsNeedingReminder.mockResolvedValue([mockAppointment]);
      
      await service.processReminders();

      expect(mockRepo.markAsReminded).not.toHaveBeenCalled();
    });

    it('TC-REM-03: should handle empty appointment list', async () => {
      mockRepo.findAppointmentsNeedingReminder.mockResolvedValue([]);

      const result = await service.processReminders();

      expect(result.processed).toBe(0);
      expect(mockMailer.sendAppointmentReminderEmail).not.toHaveBeenCalled();
    });
  });

  describe('Data Mapping (Defensive Checks)', () => {
    it('TC-REM-04: should handle null/invalid address parts', async () => {
      const appointmentWithNulls = {
        ...mockAppointment,
        address: 'null',
        ward_name: null,
        district_name: 'District A',
        province_name: '',
      };
      mockRepo.findAppointmentsNeedingReminder.mockResolvedValue([appointmentWithNulls]);

      await service.processReminders();

      expect(mockMailer.sendAppointmentReminderEmail).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          clinicAddress: 'District A', // Only valid part
        }),
      );
    });

    it('TC-REM-05: should use doctor_name from SQL (fallback is "Bác sĩ trực")', async () => {
      const appointmentWithFallbackDoctor = {
        ...mockAppointment,
        doctor_name: 'Bác sĩ trực',
      };
      mockRepo.findAppointmentsNeedingReminder.mockResolvedValue([appointmentWithFallbackDoctor]);

      await service.processReminders();

      expect(mockMailer.sendAppointmentReminderEmail).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          doctorName: 'Bác sĩ trực',
        }),
      );
    });

    it('TC-REM-06: should handle null service_names', async () => {
      const appointmentWithNoServices = {
        ...mockAppointment,
        service_names: null,
      };
      mockRepo.findAppointmentsNeedingReminder.mockResolvedValue([appointmentWithNoServices]);

      await service.processReminders();

      expect(mockMailer.sendAppointmentReminderEmail).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          services: [],
        }),
      );
    });
  });
});
