import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { PatientRescheduleAppointmentDto } from '../../../../src/modules/appointments/dto/patient-reschedule-appointment.dto';
import { StaffRescheduleAppointmentDto } from '../../../../src/modules/appointments/dto/staff-reschedule-appointment.dto';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums/appointment-status.enum';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-26 Reschedule Appointment', () => {
  const toDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayString = () => toDateString(new Date());
  const tomorrowString = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return toDateString(date);
  };
  const farFutureString = () => {
    const date = new Date();
    date.setDate(date.getDate() + 90);
    return toDateString(date);
  };

  const createAppointment = (overrides: Record<string, unknown> = {}) => ({
    _id: 'appointment-1',
    patientId: 'patient-1',
    clinicId: 'clinic-1',
    doctorId: '550e8400-e29b-41d4-a716-446655440002',
    clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440003',
    extraHour: null,
    extraRoomId: null,
    appointmentDate: tomorrowString(),
    appointmentHour: `${tomorrowString()}T08:00:00.000Z`,
    status: AppointmentStatus.PENDING,
    deletedAt: null,
    ...overrides,
  });

  const createPatientContext = (appointmentOverrides: Record<string, unknown> = {}) => ({
    appointmentRepository: {
      findByIdWithRelations: jest
        .fn()
        .mockResolvedValue(createAppointment(appointmentOverrides)),
    },
    handleStandardReschedule: jest.fn().mockResolvedValue({ ok: 'standard' }),
    handleOutOfHoursReschedule: jest.fn().mockResolvedValue({ ok: 'out-of-hours' }),
  });

  it('UT-26-01: Patient reschedules standard appointment successfully.', async () => {
    const appointmentsService = {
      patientRescheduleAppointment: jest.fn().mockResolvedValue({ _id: 'appointment-1' }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );
    const dto = plainToInstance(PatientRescheduleAppointmentDto, {
      appointmentDate: tomorrowString(),
      clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440003',
      doctorId: '550e8400-e29b-41d4-a716-446655440002',
    });

    await controller.patientRescheduleAppointment(
      { user: { _id: 'patient-1' } },
      'appointment-1',
      dto,
    );

    expect(appointmentsService.patientRescheduleAppointment).toHaveBeenCalledWith(
      'patient-1',
      'appointment-1',
      dto,
    );
  });

  it('UT-26-02: Patient reschedules out-of-hours appointment successfully.', async () => {
    const appointment = createAppointment({
      clinicShiftHourId: null,
      extraHour: `${tomorrowString()}T19:30:00.000Z`,
      appointmentDate: '2099-01-10',
      appointmentHour: '2099-01-10T19:30:00.000Z',
    });
    const savedAppointment = {
      ...appointment,
      extraHour: new Date('2099-01-10T12:30:00.000Z'),
      appointmentDate: new Date('2099-01-10T00:00:00.000Z'),
      updatedAt: new Date('2099-01-01T00:00:00.000Z'),
    };
    const conflictBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(null),
    };
    const serviceContext = {
      dataSource: {
        createQueryBuilder: jest.fn().mockReturnValue(conflictBuilder),
        manager: {},
      },
      checkPatientAppointmentOverlap: jest.fn().mockResolvedValue(undefined),
      appointmentRepository: {
        save: jest.fn().mockResolvedValue(savedAppointment),
      },
      loadAppointmentServicesAndRooms: jest.fn().mockResolvedValue({
        services: [],
        clinicRooms: [],
      }),
      transformToResponseDto: jest.fn().mockImplementation((value) => value),
    };

    const result = await (AppointmentsService.prototype as any).handleOutOfHoursReschedule.call(
      serviceContext,
      appointment,
      {
        appointmentDate: '2099-01-10',
        extraHour: '2099-01-10T19:30:00.000+07:00',
      },
      new Date('2099-01-10T00:00:00.000Z'),
    );

    expect(serviceContext.checkPatientAppointmentOverlap).toHaveBeenCalled();
    expect(result.extraHour).toEqual(new Date('2099-01-10T12:30:00.000Z'));
  });

  it('UT-26-03: Staff reschedules appointment successfully.', async () => {
    const appointmentsService = {
      staffRescheduleAppointment: jest.fn().mockResolvedValue({ _id: 'appointment-1' }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );
    const dto = plainToInstance(StaffRescheduleAppointmentDto, {
      appointmentDate: tomorrowString(),
      clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440003',
    });

    await controller.staffRescheduleAppointment('appointment-1', dto);

    expect(appointmentsService.staffRescheduleAppointment).toHaveBeenCalledWith(
      'appointment-1',
      dto,
    );
  });

  it('UT-26-04: Reject missing or invalid JWT.', () => {
    const patientGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.patientRescheduleAppointment,
    );
    const staffGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.staffRescheduleAppointment,
    );

    expect(patientGuards).toHaveLength(2);
    expect(staffGuards).toHaveLength(2);
  });

  it('UT-26-05: Reject missing or unauthorized appointment.', async () => {
    const missingContext = {
      appointmentRepository: {
        findByIdWithRelations: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(
      AppointmentsService.prototype.patientRescheduleAppointment.call(
        missingContext,
        'patient-1',
        'missing-appointment',
        {
          appointmentDate: tomorrowString(),
          clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440003',
          doctorId: '550e8400-e29b-41d4-a716-446655440002',
        },
      ),
    ).rejects.toThrow(new NotFoundException('Appointment not found'));

    const foreignContext = createPatientContext({ patientId: 'patient-2' });

    await expect(
      AppointmentsService.prototype.patientRescheduleAppointment.call(
        foreignContext,
        'patient-1',
        'appointment-1',
        {
          appointmentDate: tomorrowString(),
          clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440003',
          doctorId: '550e8400-e29b-41d4-a716-446655440002',
        },
      ),
    ).rejects.toThrow(
      new ForbiddenException('You can only reschedule your own appointments'),
    );
  });

  it('UT-26-06: Reject invalid reschedulable status.', async () => {
    const serviceContext = createPatientContext({ status: AppointmentStatus.CONFIRMED });

    await expect(
      AppointmentsService.prototype.patientRescheduleAppointment.call(
        serviceContext,
        'patient-1',
        'appointment-1',
        {
          appointmentDate: tomorrowString(),
          clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440003',
          doctorId: '550e8400-e29b-41d4-a716-446655440002',
        },
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot reschedule standard booking with status "CONFIRMED". Only PENDING appointments can be rescheduled.',
      ),
    );
  });

  it('UT-26-07: Reject invalid date range or missing required standard fields.', async () => {
    const pastContext = createPatientContext();

    await expect(
      AppointmentsService.prototype.patientRescheduleAppointment.call(
        pastContext,
        'patient-1',
        'appointment-1',
        {
          appointmentDate: '2000-01-01',
          clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440003',
          doctorId: '550e8400-e29b-41d4-a716-446655440002',
        },
      ),
    ).rejects.toThrow(
      new BadRequestException('Appointment date must be today or in the future'),
    );

    const farContext = createPatientContext();

    await expect(
      AppointmentsService.prototype.patientRescheduleAppointment.call(
        farContext,
        'patient-1',
        'appointment-1',
        {
          appointmentDate: farFutureString(),
          clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440003',
          doctorId: '550e8400-e29b-41d4-a716-446655440002',
        },
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Appointment date cannot be more than 60 days in the future',
      ),
    );

    const missingFieldContext = {
      dataSource: {
        createQueryRunner: jest.fn(),
      },
    };

    await expect(
      (AppointmentsService.prototype as any).handleStandardReschedule.call(
        missingFieldContext,
        createAppointment(),
        { appointmentDate: tomorrowString() },
        new Date(`${tomorrowString()}T00:00:00.000Z`),
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Clinic shift hour ID is required for standard booking reschedule',
      ),
    );
  });

  it('UT-26-08: Reject doctor shift mismatch or no-op staff payload.', async () => {
    const noOpContext = {
      appointmentRepository: {
        findByIdWithRelations: jest.fn().mockResolvedValue(createAppointment()),
      },
    };

    await expect(
      AppointmentsService.prototype.staffRescheduleAppointment.call(
        noOpContext,
        'appointment-1',
        {},
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'At least one field (appointmentDate, clinicShiftHourId, extraHour, or extraRoomId) must be provided',
      ),
    );

    const mismatchQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(null),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
    };
    const mismatchContext = {
      appointmentRepository: {
        findByIdWithRelations: jest.fn().mockResolvedValue(createAppointment()),
      },
      dataSource: {
        createQueryBuilder: jest.fn().mockReturnValue(mismatchQueryBuilder),
      },
    };

    await expect(
      AppointmentsService.prototype.staffRescheduleAppointment.call(
        mismatchContext,
        'appointment-1',
        {
          appointmentDate: tomorrowString(),
          clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440003',
        },
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Doctor does not have a schedule for this shift on the selected date',
      ),
    );
  });

  it('UT-26-09: Reject slot conflict.', async () => {
    const shiftBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        _id: 'shift-1',
        start_hour: '08:00:00',
        end_hour: '09:00:00',
        limit: 10,
        clinic_id: 'clinic-1',
      }),
    };
    const doctorScheduleBuilder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ schedule_id: 'schedule-1' }),
    };
    const conflictBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ _id: 'conflict-1' }),
    };
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(shiftBuilder)
          .mockReturnValueOnce(doctorScheduleBuilder)
          .mockReturnValueOnce(conflictBuilder),
      },
    };
    const serviceContext = {
      dataSource: {
        createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      },
      getBookedShiftHourCount: jest.fn().mockResolvedValue(0),
    };

    await expect(
      (AppointmentsService.prototype as any).handleStandardReschedule.call(
        serviceContext,
        createAppointment(),
        {
          appointmentDate: tomorrowString(),
          clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440003',
          doctorId: '550e8400-e29b-41d4-a716-446655440002',
        },
        new Date(`${tomorrowString()}T00:00:00.000Z`),
      ),
    ).rejects.toThrow(
      new ConflictException(
        'This time slot is already booked. Please choose another time.',
      ),
    );
  });

  it('UT-26-10: Accept reschedule to today.', async () => {
    const shiftBuilder = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        _id: 'shift-1',
        start_hour: '08:00:00',
        end_hour: '09:00:00',
        limit: 10,
        clinic_id: 'clinic-1',
      }),
    };
    const doctorScheduleBuilder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ schedule_id: 'schedule-1' }),
    };
    const conflictBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(null),
    };
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(shiftBuilder)
          .mockReturnValueOnce(doctorScheduleBuilder)
          .mockReturnValueOnce(conflictBuilder)
          .mockReturnValueOnce(updateBuilder),
      },
    };
    const updatedAppointment = createAppointment({ appointmentDate: todayString() });
    const serviceContext = {
      dataSource: {
        createQueryRunner: jest.fn().mockReturnValue(queryRunner),
      },
      getBookedShiftHourCount: jest.fn().mockResolvedValue(0),
      checkPatientAppointmentOverlap: jest.fn().mockResolvedValue(undefined),
      appointmentRepository: {
        findByIdWithRelations: jest.fn().mockResolvedValue(updatedAppointment),
      },
      loadAppointmentServicesAndRooms: jest.fn().mockResolvedValue({
        services: [],
        clinicRooms: [],
      }),
      transformToResponseDto: jest.fn().mockImplementation((value) => value),
    };

    const result = await (AppointmentsService.prototype as any).handleStandardReschedule.call(
      serviceContext,
      createAppointment(),
      {
        appointmentDate: todayString(),
        clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440003',
        doctorId: '550e8400-e29b-41d4-a716-446655440002',
      },
      new Date(`${todayString()}T00:00:00.000Z`),
    );

    expect(result.appointmentDate).toBe(todayString());
  });

  it('UT-26-11: Reject invalid DTO field formats.', async () => {
    const patientErrors = await validate(
      plainToInstance(PatientRescheduleAppointmentDto, {
        appointmentDate: 'not-a-date',
        clinicShiftHourId: 'invalid_uuid',
        extraHour: 'not-a-datetime',
        doctorId: 'invalid_uuid',
      }),
    );
    const staffErrors = await validate(
      plainToInstance(StaffRescheduleAppointmentDto, {
        appointmentDate: 'not-a-date',
        clinicShiftHourId: 'invalid_uuid',
        extraHour: 'not-a-datetime',
        extraRoomId: 'invalid_uuid',
      }),
    );
    const messages = [...patientErrors, ...staffErrors].flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    expect(messages).toContain(
      'Appointment date must be a valid date in YYYY-MM-DD format',
    );
    expect(messages).toContain('Clinic shift hour ID must be a valid UUID');
    expect(messages).toContain('Extra hour must be a valid ISO 8601 timestamp');
    expect(messages).toContain('Doctor ID must be a valid UUID');
    expect(messages).toContain(
      'Appointment date must be a valid date format (YYYY-MM-DD)',
    );
    expect(messages).toContain('Extra hour must be a valid datetime format');
    expect(messages).toContain('Extra room ID must be a valid UUID');
  });
});
