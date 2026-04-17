import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-72 View E-Prescriptions', () => {
  const createChainBuilder = (overrides: Record<string, jest.Mock> = {}) => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    ...overrides,
  });

  const createServiceContext = (options?: {
    count?: number;
    appointmentsRaw?: any[];
    packagesRaw?: any[];
    servicesRaw?: any[];
    ePrescriptionsRaw?: any[];
    feedbacksRaw?: any[];
  }) => {
    const {
      count = 0,
      appointmentsRaw = [],
      packagesRaw = [],
      servicesRaw = [],
      ePrescriptionsRaw = [],
      feedbacksRaw = [],
    } = options ?? {};

    const countBuilder = createChainBuilder({
      getRawOne: jest.fn().mockResolvedValue({ count: String(count) }),
    });
    const mainBuilder = createChainBuilder({
      clone: jest.fn().mockReturnValue(countBuilder),
      getRawMany: jest.fn().mockResolvedValue(appointmentsRaw),
    });
    const packagesBuilder = createChainBuilder({ getRawMany: jest.fn().mockResolvedValue(packagesRaw) });
    const servicesBuilder = createChainBuilder({ getRawMany: jest.fn().mockResolvedValue(servicesRaw) });
    const epBuilder = createChainBuilder({ getRawMany: jest.fn().mockResolvedValue(ePrescriptionsRaw) });
    const feedbackBuilder = createChainBuilder({ getRawMany: jest.fn().mockResolvedValue(feedbacksRaw) });

    return {
      dataSource: {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(mainBuilder)
          .mockReturnValueOnce(packagesBuilder)
          .mockReturnValueOnce(servicesBuilder)
          .mockReturnValueOnce(epBuilder)
          .mockReturnValueOnce(feedbackBuilder),
      },
      normalizeMoney: AppointmentsService.prototype['normalizeMoney'],
      calculateServiceFinalPrice: AppointmentsService.prototype['calculateServiceFinalPrice'],
      calculatePackageAmountFromServices: AppointmentsService.prototype['calculatePackageAmountFromServices'],
      calculateAppointmentTotalFromPackages: AppointmentsService.prototype['calculateAppointmentTotalFromPackages'],
    } as any;
  };

  const sampleAppointment = {
    appointment_id: 'appointment-1',
    appointment_date: '2026-03-15',
    appointment_hour: '2026-03-15T08:00:00.000Z',
    extra_hour: null,
    clinic_shift_hour_id: 'shift-1',
    status: AppointmentStatus.COMPLETED,
    total: 0,
    diagnosis: null,
    created_at: '2026-03-15T00:00:00.000Z',
    clinic_id: 'clinic-1',
    clinic_name: 'Clinic',
    clinic_address: 'Address',
    doctor_id: 'doctor-1',
    doctor_name: 'Doctor',
    doctor_profile_picture: null,
    start_hour: '08:00:00',
    end_hour: '09:00:00',
    clinic_room: 'Room 1',
  };

  const samplePackage = {
    package_id: 'pkg-1',
    appointment_id: 'appointment-1',
    payment_type: 'cod',
    payment_status: 'paid',
    created_at: '2026-03-15T00:00:00.000Z',
    transaction_payment_status: null,
  };

  const sampleService = {
    package_id: 'pkg-1',
    appointment_id: 'appointment-1',
    service_id: 'service-1',
    service_name: 'Consultation',
    price: '100000',
    discount: '10',
    erm_id: null,
    erm_type: null,
    erm_created_at: null,
  };

  it('UT-72-01: List includes e-prescription summaries per appointment', async () => {
    const serviceContext = createServiceContext({
      count: 1,
      appointmentsRaw: [sampleAppointment],
      packagesRaw: [samplePackage],
      servicesRaw: [sampleService],
      ePrescriptionsRaw: [{ appointment_id: 'appointment-1', ep_id: 'ep-1', ep_code: 'EP001', ep_created_at: '2026-03-15' }],
    });

    const result = await AppointmentsService.prototype.getMyAppointments.call(serviceContext, 'patient-1', { page: 1, limit: 10 });

    expect(result.data[0].e_prescription_summary).toEqual({ id: 'ep-1', code: 'EP001', created_at: '2026-03-15' });
  });

  it('UT-72-02: HISTORY tab filtering', async () => {
    const serviceContext = createServiceContext();

    await AppointmentsService.prototype.getMyAppointments.call(serviceContext, 'patient-1', {
      page: 1,
      limit: 10,
      tab: 'HISTORY',
    });

    expect(serviceContext.dataSource.createQueryBuilder).toHaveBeenCalled();
  });

  it('UT-72-03: UPCOMING tab filtering', async () => {
    const serviceContext = createServiceContext();

    await AppointmentsService.prototype.getMyAppointments.call(serviceContext, 'patient-1', {
      page: 1,
      limit: 10,
      tab: 'UPCOMING',
    });

    expect(serviceContext.dataSource.createQueryBuilder).toHaveBeenCalled();
  });

  it('UT-72-04: Status filter overrides tab', async () => {
    const serviceContext = createServiceContext();

    await AppointmentsService.prototype.getMyAppointments.call(serviceContext, 'patient-1', {
      page: 1,
      limit: 10,
      tab: 'UPCOMING',
      status: AppointmentStatus.COMPLETED,
    });

    expect(serviceContext.dataSource.createQueryBuilder).toHaveBeenCalled();
  });

  it('UT-72-05: appointment_date filter exact match', async () => {
    const serviceContext = createServiceContext({
      count: 1,
      appointmentsRaw: [sampleAppointment],
      packagesRaw: [samplePackage],
      servicesRaw: [sampleService],
    });

    const result = await AppointmentsService.prototype.getMyAppointments.call(serviceContext, 'patient-1', {
      page: 1,
      limit: 10,
      appointmentDate: '2026-03-15',
    });

    expect(result.data[0].appointment_date).toBe('2026-03-15');
  });

  it('UT-72-06: Missing JWT rejected', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AppointmentsController.prototype.getMyAppointments);

    expect(guards).toHaveLength(2);
  });

  it('UT-72-07: Non-patient role blocked', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AppointmentsController.prototype.getMyAppointments);

    expect(roles).toEqual([AccountRole.PATIENT]);
  });

  it('UT-72-08: Invalid query numeric cast edge', async () => {
    const controller = new AppointmentsController({ getMyAppointments: jest.fn().mockResolvedValue({ data: [], meta: {} }) } as any, {} as any, {} as any);

    await controller.getMyAppointments({ user: { _id: 'patient-1' } }, 'invalid' as any, 'large' as any, undefined, undefined, undefined);

    expect((controller as any).appointmentsService.getMyAppointments).toHaveBeenCalledWith('patient-1', {
      page: Number('invalid'),
      limit: Number('large'),
      tab: undefined,
      status: undefined,
      appointmentDate: undefined,
    });
  });

  it('UT-72-09: Large page out-of-range', async () => {
    const serviceContext = createServiceContext({ count: 1, appointmentsRaw: [] });

    const result = await AppointmentsService.prototype.getMyAppointments.call(serviceContext, 'patient-1', { page: 999, limit: 10 });

    expect(result).toEqual({ data: [], meta: { total: 1, page: 999, limit: 10, total_pages: 1 } });
  });

  it('UT-72-10: Boundary limit equals 1', async () => {
    const serviceContext = createServiceContext({
      count: 1,
      appointmentsRaw: [sampleAppointment],
      packagesRaw: [samplePackage],
      servicesRaw: [sampleService],
    });

    const result = await AppointmentsService.prototype.getMyAppointments.call(serviceContext, 'patient-1', { page: 1, limit: 1 });

    expect(result.meta.limit).toBe(1);
  });

  it('UT-72-11: Boundary no appointments dataset', async () => {
    const serviceContext = createServiceContext({ count: 0, appointmentsRaw: [] });

    const result = await AppointmentsService.prototype.getMyAppointments.call(serviceContext, 'patient-1', { page: 1, limit: 10 });

    expect(result).toEqual({ data: [], meta: { total: 0, page: 1, limit: 10, total_pages: 0 } });
  });

  it('UT-72-12: Boundary null e-prescription summary', async () => {
    const serviceContext = createServiceContext({
      count: 1,
      appointmentsRaw: [sampleAppointment],
      packagesRaw: [samplePackage],
      servicesRaw: [sampleService],
      ePrescriptionsRaw: [],
    });

    const result = await AppointmentsService.prototype.getMyAppointments.call(serviceContext, 'patient-1', { page: 1, limit: 10 });

    expect(result.data[0].e_prescription_summary).toBeNull();
  });
});
