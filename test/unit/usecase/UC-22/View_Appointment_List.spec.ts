import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { QueryAppointmentDto } from '../../../../src/modules/appointments/dto/query-appointment.dto';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-22 View Appointment List', () => {
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
    const packagesBuilder = createChainBuilder({
      getRawMany: jest.fn().mockResolvedValue(packagesRaw),
    });
    const servicesBuilder = createChainBuilder({
      getRawMany: jest.fn().mockResolvedValue(servicesRaw),
    });
    const ePrescriptionsBuilder = createChainBuilder({
      getRawMany: jest.fn().mockResolvedValue(ePrescriptionsRaw),
    });
    const feedbacksBuilder = createChainBuilder({
      getRawMany: jest.fn().mockResolvedValue(feedbacksRaw),
    });

    return {
      dataSource: {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(mainBuilder)
          .mockReturnValueOnce(packagesBuilder)
          .mockReturnValueOnce(servicesBuilder)
          .mockReturnValueOnce(ePrescriptionsBuilder)
          .mockReturnValueOnce(feedbacksBuilder),
      },
      normalizeMoney: AppointmentsService.prototype['normalizeMoney'],
      calculateServiceFinalPrice:
        AppointmentsService.prototype['calculateServiceFinalPrice'],
      calculatePackageAmountFromServices:
        AppointmentsService.prototype['calculatePackageAmountFromServices'],
      calculateAppointmentTotalFromPackages:
        AppointmentsService.prototype['calculateAppointmentTotalFromPackages'],
    } as any;
  };

  it('UT-22-01: View default appointment list successfully.', async () => {
    const appointmentsService = {
      getMyAppointments: jest.fn().mockResolvedValue({ data: [], meta: {} }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );

    await controller.getMyAppointments(
      { user: { _id: 'patient-1' } },
      1 as any,
      10 as any,
      undefined,
      undefined,
      undefined,
    );

    expect(appointmentsService.getMyAppointments).toHaveBeenCalledWith(
      'patient-1',
      {
        page: 1,
        limit: 10,
        tab: undefined,
        status: undefined,
        appointmentDate: undefined,
      },
    );
  });

  it('UT-22-02: View UPCOMING or HISTORY filtered list successfully.', async () => {
    const serviceContext = createServiceContext();

    await AppointmentsService.prototype.getMyAppointments.call(serviceContext, 'patient-1', {
      page: 1,
      limit: 10,
      tab: 'UPCOMING',
    });

    expect(serviceContext.dataSource.createQueryBuilder).toHaveBeenCalled();
  });

  it('UT-22-03: View list successfully with status/date filter.', async () => {
    const serviceContext = createServiceContext({
      count: 1,
      appointmentsRaw: [
        {
          appointment_id: 'appointment-1',
          appointment_date: '2026-03-15',
          appointment_hour: '2026-03-15T08:00:00.000Z',
          extra_hour: null,
          clinic_shift_hour_id: 'shift-1',
          status: AppointmentStatus.CONFIRMED,
          total: 0,
          diagnosis: null,
          clinic_id: 'clinic-1',
          clinic_name: 'Clinic',
          clinic_address: 'Address',
          doctor_id: 'doctor-1',
          doctor_name: 'Doctor',
          doctor_profile_picture: null,
          start_hour: '08:00:00',
          end_hour: '09:00:00',
          clinic_room: 'Room 1',
        },
      ],
      packagesRaw: [
        {
          package_id: 'package-1',
          appointment_id: 'appointment-1',
          payment_type: 'cod',
          payment_status: 'paid',
          created_at: '2026-03-15T00:00:00.000Z',
          transaction_payment_status: null,
        },
      ],
      servicesRaw: [
        {
          package_id: 'package-1',
          appointment_id: 'appointment-1',
          service_id: 'service-1',
          service_name: 'Consultation',
          price: '100000',
          discount: '10',
          erm_id: null,
          erm_type: null,
          erm_created_at: null,
        },
      ],
    });

    const result = await AppointmentsService.prototype.getMyAppointments.call(
      serviceContext,
      'patient-1',
      {
        page: 1,
        limit: 10,
        status: AppointmentStatus.CONFIRMED,
        appointmentDate: '2026-03-15',
      },
    );

    expect(result.meta).toEqual({ total: 1, page: 1, limit: 10, total_pages: 1 });
    expect(result.data[0]).toMatchObject({
      _id: 'appointment-1',
      status: AppointmentStatus.CONFIRMED,
      appointment_date: '2026-03-15',
      payment_type: 'cod',
      payment_status: 'paid',
    });
  });

  it('UT-22-04: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.getMyAppointments,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-22-05: Reject authenticated non-patient role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.getMyAppointments,
    );

    expect(roles).toEqual([AccountRole.PATIENT]);
  });

  it('UT-22-06: Reject invalid query DTO values.', async () => {
    const errors = await validate(
      plainToInstance(QueryAppointmentDto, {
        tab: 'INVALID',
        status: 'INVALID',
        appointmentDate: 'not-a-date',
        page: 0,
        limit: 0,
      }),
    );

    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain('Tab must be either UPCOMING or HISTORY');
    expect(messages).toContain('Invalid appointment status');
    expect(messages).toContain('Invalid date format. Use YYYY-MM-DD');
    expect(messages).toContain('Page must be at least 1');
    expect(messages).toContain('Limit must be at least 1');
  });

  it('UT-22-07: Return empty list when patient has no appointments.', async () => {
    const serviceContext = createServiceContext();

    const result = await AppointmentsService.prototype.getMyAppointments.call(
      serviceContext,
      'patient-1',
      { page: 1, limit: 10 },
    );

    expect(result).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 10, total_pages: 0 },
    });
  });

  it('UT-22-08: Return empty list for page overflow.', async () => {
    const serviceContext = createServiceContext({ count: 1, appointmentsRaw: [] });

    const result = await AppointmentsService.prototype.getMyAppointments.call(
      serviceContext,
      'patient-1',
      { page: 999, limit: 10 },
    );

    expect(result).toEqual({
      data: [],
      meta: { total: 1, page: 999, limit: 10, total_pages: 1 },
    });
  });

  it('UT-22-09: Return list containing out-of-hours appointment rows.', async () => {
    const serviceContext = createServiceContext({
      count: 1,
      appointmentsRaw: [
        {
          appointment_id: 'appointment-2',
          appointment_date: '2026-03-16',
          appointment_hour: '2026-03-16T19:30:00.000Z',
          extra_hour: '2026-03-16T19:30:00.000Z',
          clinic_shift_hour_id: null,
          status: AppointmentStatus.PENDING,
          total: 0,
          diagnosis: null,
          clinic_id: 'clinic-1',
          clinic_name: 'Clinic',
          clinic_address: 'Address',
          doctor_id: null,
          doctor_name: null,
          doctor_profile_picture: null,
          start_hour: null,
          end_hour: null,
          clinic_room: 'Extra Room',
        },
      ],
    });

    const result = await AppointmentsService.prototype.getMyAppointments.call(
      serviceContext,
      'patient-1',
      { page: 1, limit: 10 },
    );

    expect(result.data[0]).toMatchObject({
      _id: 'appointment-2',
      extra_hour: '2026-03-16T19:30:00.000Z',
      clinic_shift_hour_id: null,
      start_hour: null,
      end_hour: null,
      clinic_room: 'Extra Room',
    });
  });
});
