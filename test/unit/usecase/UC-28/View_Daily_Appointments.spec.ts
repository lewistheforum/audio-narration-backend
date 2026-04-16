import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { QueryDoctorAppointmentDto } from '../../../../src/modules/appointments/dto/query-doctor-appointment.dto';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums/appointment-status.enum';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-28 View Daily Appointments', () => {
  const createQueryBuilder = (appointments: any[]) => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(appointments),
  });

  const createServiceContext = (appointments: any[]) => ({
    dataSource: {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(createQueryBuilder(appointments)),
      }),
    },
    appointmentPackageRepository: {
      findServicesByAppointmentIds: jest.fn().mockResolvedValue(new Map()),
    },
    employeeScheduleRepository: {
      findClinicRoomsForMultipleAppointments: jest.fn().mockResolvedValue(new Map()),
    },
    transformToResponseDto: jest.fn().mockImplementation((appointment) => ({
      _id: appointment._id,
      status: appointment.status,
      extraHour: appointment.extraHour ?? null,
    })),
  } as any);

  it('UT-28-01: View default doctor appointments successfully.', async () => {
    const appointmentsService = {
      getDoctorAppointments: jest.fn().mockResolvedValue({ appointments: [] }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );
    const query = plainToInstance(QueryDoctorAppointmentDto, {});

    await controller.getDoctorAppointments({ user: { _id: 'doctor-1' } }, query);

    expect(appointmentsService.getDoctorAppointments).toHaveBeenCalledWith('doctor-1', query);
  });

  it('UT-28-02: View doctor appointments by date successfully.', async () => {
    const appointmentsService = {
      getDoctorAppointments: jest.fn().mockResolvedValue({ appointments: [] }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );
    const query = plainToInstance(QueryDoctorAppointmentDto, { date: '2026-04-07' });

    await controller.getDoctorAppointments({ user: { _id: 'doctor-1' } }, query);

    expect(appointmentsService.getDoctorAppointments).toHaveBeenCalledWith('doctor-1', query);
  });

  it('UT-28-03: View doctor appointments by explicit status successfully.', async () => {
    const appointmentsService = {
      getDoctorAppointments: jest.fn().mockResolvedValue({ appointments: [] }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );
    const query = plainToInstance(QueryDoctorAppointmentDto, {
      date: '2026-04-07',
      status: AppointmentStatus.CHECKED_IN,
    });

    await controller.getDoctorAppointments({ user: { _id: 'doctor-1' } }, query);

    expect(appointmentsService.getDoctorAppointments).toHaveBeenCalledWith('doctor-1', query);
  });

  it('UT-28-04: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.getDoctorAppointments,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-28-05: Reject authenticated non-doctor role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.getDoctorAppointments,
    );

    expect(roles).toEqual([AccountRole.DOCTOR]);
  });

  it('UT-28-06: Reject invalid query DTO values.', async () => {
    const errors = await validate(
      plainToInstance(QueryDoctorAppointmentDto, {
        date: 'invalid_date',
        status: 'INVALID',
      }),
    );
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain('Date must be in YYYY-MM-DD format');
    expect(messages).toContain('Invalid appointment status');
  });

  it('UT-28-07: Return empty list when no matching appointments exist.', async () => {
    const serviceContext = createServiceContext([]);

    const result = await AppointmentsService.prototype.getDoctorAppointments.call(
      serviceContext,
      'doctor-1',
      { date: '2026-04-07' },
    );

    expect(result).toEqual({ appointments: [] });
  });

  it('UT-28-08: Exclude out-of-hours appointments from result.', async () => {
    const serviceContext = createServiceContext([
      {
        _id: 'appointment-1',
        status: AppointmentStatus.CHECKED_IN,
        extraHour: null,
        clinicShiftHourId: 'shift-1',
        doctorId: 'doctor-1',
        appointmentDate: '2026-04-07',
      },
    ]);

    const result = await AppointmentsService.prototype.getDoctorAppointments.call(
      serviceContext,
      'doctor-1',
      {},
    );

    expect(result.appointments).toEqual([
      { _id: 'appointment-1', status: AppointmentStatus.CHECKED_IN, extraHour: null },
    ]);
  });
});
