import { AppointmentCronController } from '../../../../src/modules/appointments/appointment-cron.controller';
import { AppointmentCronService } from '../../../../src/modules/appointments/appointment-cron.service';

describe('UC-112 Auto Send Appointment Reminder', () => {
  const baseRow = {
    appointment_id: '123e4567-e89b-42d3-a456-426614174801',
    patient_email: 'p@example.com',
    patient_name: 'Patient',
    clinic_name: 'Clinic',
    appointment_date: '2026-12-20',
    appointment_hour: '2026-12-20T09:00:00.000Z',
    address: 'Addr',
    ward_name: 'Ward',
    district_name: 'Dist',
    province_name: 'Prov',
    manager_phone: '0901',
    clinic_admin_phone: '0902',
    doctor_name: 'Doctor',
    service_names: 'A, B',
  };

  const createService = () =>
    ({
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      appointmentRepository: {
        findAppointmentsNeedingReminder: jest.fn().mockResolvedValue([baseRow]),
      },
      mailerService: {
        sendAppointmentReminderEmail: jest.fn().mockResolvedValue(undefined),
      },
      sendEmail: (AppointmentCronService.prototype as any).sendEmail,
      processReminders: AppointmentCronService.prototype.processReminders,
    }) as any;

  it('UT-112-01: Manual trigger processes reminders and returns summary.', async () => {
    const controller = {
      appointmentCronService: {
        processReminders: jest.fn().mockResolvedValue({ processed: 1, success: 1, failed: 0 }),
      },
    } as any;

    const result = await AppointmentCronController.prototype.triggerReminders.call(controller);

    expect(result).toEqual({ processed: 1, success: 1, failed: 0 });
  });

  it('UT-112-02: Cron job calls process flow successfully.', async () => {
    const service = createService();

    await AppointmentCronService.prototype.handleAppointmentReminders.call(service);

    expect(service.logger.log).toHaveBeenCalledWith('⏰ Starting Appointment Reminder Cron Job...');
  });

  it('UT-112-03: Reminder email sent and counts success.', async () => {
    const service = createService();

    const result = await AppointmentCronService.prototype.processReminders.call(service);

    expect(result.success).toBe(1);
    expect(service.mailerService.sendAppointmentReminderEmail).toHaveBeenCalled();
  });

  it('UT-112-04: Empty reminder set returns zero counts.', async () => {
    const service = createService();
    service.appointmentRepository.findAppointmentsNeedingReminder.mockResolvedValue([]);

    const result = await AppointmentCronService.prototype.processReminders.call(service);

    expect(result).toEqual({ processed: 0, success: 0, failed: 0 });
  });

  it('UT-112-05: sendEmail skips record when patient email missing/null.', async () => {
    const service = createService();

    await (AppointmentCronService.prototype as any).sendEmail.call(service, { ...baseRow, patient_email: 'null' });

    expect(service.mailerService.sendAppointmentReminderEmail).not.toHaveBeenCalled();
    expect(service.logger.warn).toHaveBeenCalled();
  });

  it('UT-112-06: sendEmail failure increments failed count.', async () => {
    const service = createService();
    service.mailerService.sendAppointmentReminderEmail.mockRejectedValue(new Error('mail fail'));

    const result = await AppointmentCronService.prototype.processReminders.call(service);

    expect(result.failed).toBe(1);
  });

  it('UT-112-07: processReminders catches per-item error and continues.', async () => {
    const service = createService();
    service.appointmentRepository.findAppointmentsNeedingReminder.mockResolvedValue([
      baseRow,
      { ...baseRow, appointment_id: '2' },
    ]);
    service.mailerService.sendAppointmentReminderEmail
      .mockRejectedValueOnce(new Error('fail one'))
      .mockResolvedValueOnce(undefined);

    const result = await AppointmentCronService.prototype.processReminders.call(service);

    expect(result.processed).toBe(2);
    expect(result.success + result.failed).toBe(2);
  });

  it('UT-112-08: Cron wrapper catches processReminders exception.', async () => {
    const service = createService();
    service.processReminders = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(AppointmentCronService.prototype.handleAppointmentReminders.call(service)).resolves.toBeUndefined();
    expect(service.logger.error).toHaveBeenCalled();
  });

  it('UT-112-09: Invalid date/hour fields map to fallback N/A but still tries send.', async () => {
    const service = createService();

    await (AppointmentCronService.prototype as any).sendEmail.call(service, {
      ...baseRow,
      appointment_date: null,
      appointment_hour: null,
    });

    const payload = service.mailerService.sendAppointmentReminderEmail.mock.calls[0][1];
    expect(payload.appointmentDate).toBe('N/A');
    expect(payload.appointmentHour).toBe('N/A');
  });

  it('UT-112-10: service_names missing maps empty services list.', async () => {
    const service = createService();

    await (AppointmentCronService.prototype as any).sendEmail.call(service, {
      ...baseRow,
      service_names: null,
    });

    const payload = service.mailerService.sendAppointmentReminderEmail.mock.calls[0][1];
    expect(payload.services).toEqual([]);
  });

  it('UT-112-11: SQL query returns malformed data causing failure branch.', async () => {
    const service = createService();
    service.appointmentRepository.findAppointmentsNeedingReminder.mockResolvedValue([
      { appointment_id: 'bad', patient_email: 'ok@example.com' },
    ]);
    service.mailerService.sendAppointmentReminderEmail.mockRejectedValue(new Error('bad row'));

    const result = await AppointmentCronService.prototype.processReminders.call(service);

    expect(result.failed).toBe(1);
  });

  it('UT-112-12: Repository/query runtime error bubbles from processReminders.', async () => {
    const service = createService();
    service.appointmentRepository.findAppointmentsNeedingReminder.mockRejectedValue(new Error('query fail'));

    await expect(AppointmentCronService.prototype.processReminders.call(service)).rejects.toThrow('query fail');
  });

  it('UT-112-13: Exactly one appointment in queue processed.', async () => {
    const service = createService();
    service.appointmentRepository.findAppointmentsNeedingReminder.mockResolvedValue([baseRow]);

    const result = await AppointmentCronService.prototype.processReminders.call(service);

    expect(result.processed).toBe(1);
  });

  it('UT-112-14: Large queue processed with Promise.allSettled.', async () => {
    const service = createService();
    const rows = Array.from({ length: 50 }, (_, i) => ({ ...baseRow, appointment_id: `id-${i}` }));
    service.appointmentRepository.findAppointmentsNeedingReminder.mockResolvedValue(rows);

    const result = await AppointmentCronService.prototype.processReminders.call(service);

    expect(result.processed).toBe(50);
    expect(result.success).toBe(50);
  });
});
