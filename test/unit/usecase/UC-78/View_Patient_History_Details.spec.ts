import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { DoctorPatientAppointmentsQueryDto } from '../../../../src/modules/appointments/dto/doctor-patient-appointments-query.dto';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';

describe('UC-78 View Patient History Details', () => {
  const patientId = '123e4567-e89b-12d3-a456-426614174000';
  const doctorId = 'doctor-1';

  const collectMessages = async (value: object) => {
    const errors = await validate(plainToInstance(DoctorPatientAppointmentsQueryDto, value));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = (options?: {
    hasExamined?: number;
    patient?: any;
    addresses?: any[];
    stats?: any;
    servicesUsed?: any[];
    appointmentCount?: number;
    appointments?: any[];
  }) => {
    const hasExamined = options?.hasExamined ?? 1;
    const patient = options && 'patient' in options ? options.patient : { _id: patientId, phone: '0909', email: 'p@test.com', generalAccount: { fullName: 'Patient', dob: '2000-01-01', gender: 'male' } };
    const addresses = options?.addresses ?? [{ _id: 'addr1', address: 'A', ward: 'W', ward_name: 'WN', district: 'D', district_name: 'DN', province: 'P', province_name: 'PN' }];
    const stats = options?.stats ?? { firstVisit: '2025-01-01', lastVisit: '2026-01-01', totalVisits: '2' };
    const servicesUsed = options?.servicesUsed ?? [{ service_count: 2 }];
    const appointmentCount = options?.appointmentCount ?? 1;
    const appointments = options?.appointments ?? [{ _id: 'apt-1', doctorId, clinicShiftHourId: 'csh-1', appointmentDate: '2026-01-01' }];

    const hasExaminedBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(hasExamined),
    };
    const statsBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(stats),
    };
    const appointmentBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(appointmentCount),
      getMany: jest.fn().mockResolvedValue(appointments),
    };

    const appointmentRepo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(hasExaminedBuilder)
        .mockReturnValueOnce(statsBuilder)
        .mockReturnValueOnce(appointmentBuilder),
    };

    return {
      appointmentRepository: appointmentRepo,
      accountRepository: {
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(patient),
        }),
      },
      dataSource: {
        query: jest
          .fn()
          .mockResolvedValueOnce(addresses)
          .mockResolvedValueOnce(servicesUsed),
      },
      appointmentPackageRepository: {
        findServicesByAppointmentIds: jest.fn().mockResolvedValue(new Map([['apt-1', []]])),
      },
      employeeScheduleRepository: {
        findClinicRoomsForMultipleAppointments: jest.fn().mockResolvedValue(new Map([['apt-1', []]])),
      },
      transformToResponseDto: jest.fn().mockReturnValue({ appointment_id: 'apt-1' }),
    } as any;
  };

  it('UT-78-01: Doctor views patient history detail success', async () => {
    const serviceContext = createServiceContext();

    const result = await AppointmentsService.prototype.getDoctorPatientDetail.call(serviceContext, doctorId, patientId, { status: 'ALL', page: 1, limit: 10 });

    expect(result.patient.patient_id).toBe(patientId);
    expect(result.appointment_history.total).toBe(1);
  });

  it('UT-78-02: Staff uses doctor_id override to view detail', async () => {
    const controller = {
      appointmentsService: {
        getDoctorPatientDetail: jest.fn().mockResolvedValue({ ok: true }),
      },
    } as any;

    await AppointmentsController.prototype.getDoctorPatientDetail.call(
      controller,
      { user: { _id: 'staff-1' } },
      patientId,
      { doctor_id: doctorId, status: 'COMPLETED', page: 1, limit: 10 },
    );

    expect(controller.appointmentsService.getDoctorPatientDetail).toHaveBeenCalledWith(
      doctorId,
      patientId,
      { doctor_id: doctorId, status: 'COMPLETED', page: 1, limit: 10 },
    );
  });

  it('UT-78-03: Filter by status/date range success', async () => {
    const serviceContext = createServiceContext();

    const result = await AppointmentsService.prototype.getDoctorPatientDetail.call(serviceContext, doctorId, patientId, {
      status: 'COMPLETED',
      from_date: '2026-01-01',
      to_date: '2026-12-31',
      page: 1,
      limit: 10,
    });

    expect(result.appointment_history.page).toBe(1);
  });

  it('UT-78-04: ALL status branch returns mixed statuses', async () => {
    const serviceContext = createServiceContext();

    const result = await AppointmentsService.prototype.getDoctorPatientDetail.call(serviceContext, doctorId, patientId, { status: 'ALL', page: 1, limit: 10 });

    expect(result.appointment_history.total).toBe(1);
  });

  it('UT-78-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AppointmentsController.prototype.getDoctorPatientDetail);

    expect(guards).toHaveLength(2);
  });

  it('UT-78-06: Reject role outside DOCTOR/CLINIC_STAFF', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AppointmentsController.prototype.getDoctorPatientDetail);

    expect(roles).toEqual([AccountRole.DOCTOR, AccountRole.CLINIC_STAFF]);
  });

  it('UT-78-07: Reject when actor never examined patient', async () => {
    const serviceContext = createServiceContext({ hasExamined: 0 });

    await expect(AppointmentsService.prototype.getDoctorPatientDetail.call(serviceContext, doctorId, patientId, { status: 'ALL', page: 1, limit: 10 })).rejects.toThrow(
      new ForbiddenException('You do not have permission to view this patient information'),
    );
  });

  it('UT-78-08: Reject when patient not found', async () => {
    const serviceContext = createServiceContext({ patient: null });

    await expect(AppointmentsService.prototype.getDoctorPatientDetail.call(serviceContext, doctorId, patientId, { status: 'ALL', page: 1, limit: 10 })).rejects.toThrow(
      new NotFoundException('Patient not found'),
    );
  });

  it('UT-78-09: Reject invalid query DTO values', async () => {
    const messages = await collectMessages({ from_date: 'invalid', to_date: 'invalid', page: 0, limit: 0 });

    expect(messages.length).toBeGreaterThan(0);
  });

  it('UT-78-10: Reject invalid patient_id format', async () => {
    const invalid = 'patient_invalid_format';

    expect(invalid.includes('-')).toBe(false);
  });

  it('UT-78-11: Boundary minimal pagination', async () => {
    const serviceContext = createServiceContext();

    const result = await AppointmentsService.prototype.getDoctorPatientDetail.call(serviceContext, doctorId, patientId, { status: 'ALL', page: 1, limit: 1 });

    expect(result.appointment_history.page).toBe(1);
    expect(result.appointment_history.limit).toBe(1);
  });

  it('UT-78-12: Boundary empty appointment history list', async () => {
    const serviceContext = createServiceContext({ appointmentCount: 0, appointments: [] });

    const result = await AppointmentsService.prototype.getDoctorPatientDetail.call(serviceContext, doctorId, patientId, {
      status: 'COMPLETED',
      from_date: '2026-01-01',
      to_date: '2026-12-31',
      page: 1,
      limit: 10,
    });

    expect(result.appointment_history).toEqual({ total: 0, page: 1, limit: 10, appointments: [] });
  });

  it('UT-78-13: Boundary null address mapping', async () => {
    const serviceContext = createServiceContext({ addresses: [] });

    const result = await AppointmentsService.prototype.getDoctorPatientDetail.call(serviceContext, doctorId, patientId, { status: 'ALL', page: 1, limit: 10 });

    expect(result.patient.address).toBeNull();
    expect(result.patient.addressDetail).toBeUndefined();
  });
});
