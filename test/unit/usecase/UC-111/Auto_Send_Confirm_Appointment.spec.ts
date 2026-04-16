import { of, throwError } from 'rxjs';

import { AppointmentWebhookService } from '../../../../src/modules/appointments/appointment-webhook.service';

describe('UC-111 Auto Send Confirm Appointment', () => {
  const appointmentId = '123e4567-e89b-42d3-a456-426614174701';

  const baseAppointment = {
    _id: appointmentId,
    patient: { username: 'P', phone: '0909', generalAccount: { fullName: 'Patient' } },
    clinic: {
      username: 'Clinic',
      phone: '0222',
      clinicAdminInformation: { clinicName: 'Admin Clinic', clinicPhone: '0111' },
      clinicManagerInformation: { clinicBranchName: 'Branch' },
      address: { address: '1 road', wardName: 'W', districtName: 'D', provinceName: 'P' },
    },
    doctor: { username: 'Doctor', generalAccount: { fullName: 'Dr A' }, doctorInformation: null },
    appointmentDate: new Date('2026-12-20'),
    clinicShiftHour: { startHour: '09:00:00' },
    clinicShiftHourId: 'shift-id',
    doctorId: 'doctor-id',
    total: 100,
  };

  const createService = () => {
    const service = {
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      webhookUrl: 'https://n8n.example/hook',
      httpService: { post: jest.fn().mockReturnValue(of({ data: { ok: true } })) },
      appointmentRepo: { findByIdWithCompleteDetails: jest.fn().mockResolvedValue(baseAppointment) },
      appointmentPackageRepo: { findAllByAppointmentIdWithServices: jest.fn().mockResolvedValue([{ services: [{ service_name: 'S1' }] }]) },
      employeeScheduleRepo: { findClinicRoomsForMultipleAppointments: jest.fn().mockResolvedValue(new Map([[appointmentId, [{ roomName: 'Room 1' }]]])) },
    } as any;

    return service;
  };

  it('UT-111-01: Webhook sent successfully with full payload.', async () => {
    const service = createService();

    await AppointmentWebhookService.prototype.sendConfirmation.call(service, appointmentId);

    expect(service.httpService.post).toHaveBeenCalledTimes(1);
  });

  it('UT-111-02: Payload resolves clinic/doctor/service fallback values correctly.', async () => {
    const service = createService();
    service.appointmentRepo.findByIdWithCompleteDetails.mockResolvedValue({
      ...baseAppointment,
      clinic: { username: 'ClinicX', clinicAdminInformation: null, clinicManagerInformation: null, parent: null, address: null },
      doctor: { username: null, generalAccount: null, doctorInformation: null },
    });

    await AppointmentWebhookService.prototype.sendConfirmation.call(service, appointmentId);

    const payload = service.httpService.post.mock.calls[0][1];
    expect(payload.doctorName).toBe('Bác sĩ trực');
    expect(payload.clinicName).toBe('ClinicX');
  });

  it('UT-111-03: No room found branch still sends with room=N/A.', async () => {
    const service = createService();
    service.employeeScheduleRepo.findClinicRoomsForMultipleAppointments.mockResolvedValue(new Map([[appointmentId, []]]));

    await AppointmentWebhookService.prototype.sendConfirmation.call(service, appointmentId);

    const payload = service.httpService.post.mock.calls[0][1];
    expect(payload.room).toBe('N/A');
  });

  it('UT-111-04: Webhook URL missing config.', async () => {
    const service = createService();
    service.webhookUrl = '';

    await AppointmentWebhookService.prototype.sendConfirmation.call(service, appointmentId);

    expect(service.logger.warn).toHaveBeenCalledWith('N8N_APPOINTMENT_WEBHOOK_URL is not configured');
    expect(service.httpService.post).not.toHaveBeenCalled();
  });

  it('UT-111-05: Appointment id not found in repository.', async () => {
    const service = createService();
    service.appointmentRepo.findByIdWithCompleteDetails.mockResolvedValue(null);

    await AppointmentWebhookService.prototype.sendConfirmation.call(service, appointmentId);

    expect(service.logger.error).toHaveBeenCalledWith(`Appointment ${appointmentId} not found for webhook`);
  });

  it('UT-111-06: Webhook HTTP post throws error.', async () => {
    const service = createService();
    service.httpService.post.mockReturnValue(throwError(() => new Error('post failed')));

    await AppointmentWebhookService.prototype.sendConfirmation.call(service, appointmentId);

    expect(service.logger.error).toHaveBeenCalled();
  });

  it('UT-111-07: Service/package query empty still proceeds with fallback serviceName.', async () => {
    const service = createService();
    service.appointmentPackageRepo.findAllByAppointmentIdWithServices.mockResolvedValue([]);

    await AppointmentWebhookService.prototype.sendConfirmation.call(service, appointmentId);

    const payload = service.httpService.post.mock.calls[0][1];
    expect(payload.serviceName).toBe('N/A');
  });

  it('UT-111-08: Any internal exception is caught and logged (no throw).', async () => {
    const service = createService();
    service.appointmentRepo.findByIdWithCompleteDetails.mockRejectedValue(new Error('db fail'));

    await expect(AppointmentWebhookService.prototype.sendConfirmation.call(service, appointmentId)).resolves.toBeUndefined();
    expect(service.logger.error).toHaveBeenCalled();
  });

  it('UT-111-09: Payload with empty optional relation fields still posts.', async () => {
    const service = createService();
    service.appointmentRepo.findByIdWithCompleteDetails.mockResolvedValue({
      ...baseAppointment,
      patient: { username: null, phone: null, generalAccount: null },
      clinic: { username: null, phone: null, clinicAdminInformation: null, clinicManagerInformation: null, address: null, parent: null },
      doctor: null,
    });

    await AppointmentWebhookService.prototype.sendConfirmation.call(service, appointmentId);

    const payload = service.httpService.post.mock.calls[0][1];
    expect(payload.patientName).toBe('N/A');
  });

  it('UT-111-10: Very long concatenated service list still posts.', async () => {
    const service = createService();
    const services = Array.from({ length: 100 }, (_, i) => ({ service_name: `S${i}` }));
    service.appointmentPackageRepo.findAllByAppointmentIdWithServices.mockResolvedValue([{ services }]);

    await AppointmentWebhookService.prototype.sendConfirmation.call(service, appointmentId);

    const payload = service.httpService.post.mock.calls[0][1];
    expect(payload.serviceName.length).toBeGreaterThan(100);
  });
});
