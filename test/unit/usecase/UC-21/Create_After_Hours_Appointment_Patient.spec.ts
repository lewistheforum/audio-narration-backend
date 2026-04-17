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
import { CreateAppointmentFromSessionDto } from '../../../../src/modules/appointments/dto/booking-session.dto';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-21 Create After-Hours Appointment Patient', () => {
  const tomorrow = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
  };

  const tomorrowDateString = () => tomorrow().toISOString().slice(0, 10);
  const tomorrowExtraHour = () => `${tomorrowDateString()}T19:30:00`;

  const createOutOfHoursSession = (overrides: Record<string, unknown> = {}) => ({
    patientId: 'patient-1',
    bookingOption: 'out_of_hours',
    paymentMethod: 'cod',
    serviceIds: ['service-1'],
    clinicId: 'clinic-1',
    doctorId: 'doctor-1',
    appointmentDate: tomorrowDateString(),
    extraHour: tomorrowExtraHour(),
    patientNote: null,
    ...overrides,
  });

  const createServiceContext = () => ({
    bookingSessionService: {
      getSession: jest.fn(),
    },
    dataSource: {
      manager: {},
    },
    parseBookingExtraHour: jest.fn(),
    checkPatientAppointmentOverlap: jest.fn(),
    checkPatientAppointmentPerDay: jest.fn(),
    createAppointmentOutOfHours: jest.fn(),
    APPOINTMENT_CONFLICT_MESSAGE:
      'You already have a confirmed appointment at this time. Please select a different time slot.',
    ONE_APPOINTMENT_PER_DAY_MESSAGE:
      'You have an appointment scheduled for this day. You can only book one appointment per day.',
    APPOINTMENT_CONFLICT_EXCLUDED_STATUSES: ['CANCELLED', 'COMPLETED'],
    RESCHEDULE_APPOINTMENT_CONFLICT_MESSAGE:
      'You already have a confirmed appointment at this new time. Please select a different time slot.',
  });

  it('UT-21-PAT-01: Create after-hours appointment successfully with valid COD session.', async () => {
    const appointmentsService = {
      createAppointmentFromSession: jest.fn().mockResolvedValue({
        appointment_id: 'appointment-1',
        payment_type: 'cod',
        is_out_of_hours: true,
      }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );

    const result = await controller.createAppointmentFromSession(
      { user: { _id: 'patient-1' } },
      plainToInstance(CreateAppointmentFromSessionDto, {
        session_id: '550e8400-e29b-41d4-a716-446655440000',
      }),
    );

    expect(appointmentsService.createAppointmentFromSession).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      'patient-1',
    );
    expect(result).toEqual({
      message: 'Đặt lịch hẹn thành công',
      data: {
        appointment_id: 'appointment-1',
        payment_type: 'cod',
        is_out_of_hours: true,
      },
    });
  });

  it('UT-21-PAT-02: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.createAppointmentFromSession,
    );
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.createAppointmentFromSession,
    );

    expect(guards).toHaveLength(2);
    expect(roles).toEqual([AccountRole.PATIENT]);
  });

  it('UT-21-PAT-03: Reject invalid or expired session id.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.bookingSessionService.getSession.mockRejectedValue(
      new NotFoundException('Session not found or expired'),
    );

    await expect(
      AppointmentsService.prototype.createAppointmentFromSession.call(
        serviceContext,
        '550e8400-e29b-41d4-a716-446655440001',
        'patient-1',
      ),
    ).rejects.toThrow(new NotFoundException('Session not found or expired'));
  });

  it('UT-21-PAT-04: Reject session ownership mismatch.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.bookingSessionService.getSession.mockResolvedValue(
      createOutOfHoursSession({ patientId: 'patient-2' }),
    );

    await expect(
      AppointmentsService.prototype.createAppointmentFromSession.call(
        serviceContext,
        '550e8400-e29b-41d4-a716-446655440002',
        'patient-1',
      ),
    ).rejects.toThrow(
      new ForbiddenException('You do not have permission to access this session'),
    );
  });

  it('UT-21-PAT-05: Reject online payment for out-of-hours.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.bookingSessionService.getSession.mockResolvedValue(
      createOutOfHoursSession({ paymentMethod: 'online' }),
    );

    await expect(
      AppointmentsService.prototype.createAppointmentFromSession.call(
        serviceContext,
        '550e8400-e29b-41d4-a716-446655440000',
        'patient-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Out-of-hours appointments strictly require COD payment method. Online payment is not supported.',
      ),
    );
  });

  it('UT-21-PAT-06: Reject incomplete out-of-hours session.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.bookingSessionService.getSession.mockResolvedValue(
      createOutOfHoursSession({ extraHour: null }),
    );

    await expect(
      AppointmentsService.prototype.createAppointmentFromSession.call(
        serviceContext,
        '550e8400-e29b-41d4-a716-446655440000',
        'patient-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Incomplete out-of-hours booking session. Required: serviceIds, clinicId, doctorId, appointmentDate, paymentMethod, extraHour.',
      ),
    );
  });

  it('UT-21-PAT-07: Reject invalid extraHour or doctor or service availability.', async () => {
    const invalidExtraHourContext = createServiceContext();
    invalidExtraHourContext.bookingSessionService.getSession.mockResolvedValue(
      createOutOfHoursSession({ extraHour: '2026-03-15 19:30:00' }),
    );

    await expect(
      AppointmentsService.prototype.createAppointmentFromSession.call(
        invalidExtraHourContext,
        'session-1',
        'patient-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'extraHour must be a valid ISO datetime string (e.g., 2026-03-15T19:30:00)',
      ),
    );

    const mismatchedDateContext = createServiceContext();
    mismatchedDateContext.bookingSessionService.getSession.mockResolvedValue(
      createOutOfHoursSession(),
    );
    mismatchedDateContext.parseBookingExtraHour.mockReturnValue(
      new Date('2099-01-11T19:30:00.000Z'),
    );

    await expect(
      AppointmentsService.prototype.createAppointmentFromSession.call(
        mismatchedDateContext,
        'session-2',
        'patient-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Appointment date must match the date part of extraHour in Vietnam timezone.',
      ),
    );
  });

  it('UT-21-PAT-08: Reject duplicate same-time patient appointment.', async () => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ _id: 'appointment-1' }),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      }),
    };
    const serviceContext = createServiceContext();

    await expect(
      (AppointmentsService.prototype as any).checkPatientAppointmentOverlap.call(
        serviceContext,
        manager,
        'patient-1',
        new Date(`${tomorrowDateString()}T19:30:00.000Z`),
      ),
    ).rejects.toThrow(
      new ConflictException(
        'You already have a confirmed appointment at this time. Please select a different time slot.',
      ),
    );
  });

  it('UT-21-PAT-09: Reject one-appointment-per-day rule.', async () => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ _id: 'appointment-1' }),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      }),
    };
    const serviceContext = createServiceContext();

    await expect(
      (AppointmentsService.prototype as any).checkPatientAppointmentPerDay.call(
        serviceContext,
        manager,
        'patient-1',
        tomorrowDateString(),
      ),
    ).rejects.toThrow(
      new ConflictException(
        'You have an appointment scheduled for this day. You can only book one appointment per day.',
      ),
    );
  });

  it('UT-21-PAT-10: Reject invalid session_id DTO input.', async () => {
    const missingErrors = await validate(
      plainToInstance(CreateAppointmentFromSessionDto, {}),
    );
    const invalidErrors = await validate(
      plainToInstance(CreateAppointmentFromSessionDto, {
        session_id: 'invalid_session_id',
      }),
    );

    const missingMessages = missingErrors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    const invalidMessages = invalidErrors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    expect(missingMessages).toContain('Session ID is required');
    expect(invalidMessages).toContain('Invalid session ID format');
  });
});
