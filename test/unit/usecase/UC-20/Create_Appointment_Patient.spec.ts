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

describe('UC-20 Create Appointment Patient', () => {
  const tomorrowString = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  };

  const createStandardSession = (overrides: Record<string, unknown> = {}) => ({
    patientId: 'patient-1',
    paymentMethod: 'cod',
    bookingOption: 'service_first',
    serviceIds: ['service-1'],
    clinicId: 'clinic-1',
    clinicShiftHourId: 'shift-1',
    doctorId: 'doctor-1',
    appointmentDate: tomorrowString(),
    patientNote: null,
    ...overrides,
  });

  const createServiceContext = () => ({
    bookingSessionService: {
      getSession: jest.fn(),
      deleteSession: jest.fn(),
      redisClient: { ttl: jest.fn(), setex: jest.fn() },
    },
    dataSource: {
      manager: {},
    },
    checkPatientAppointmentOverlap: jest.fn(),
    checkPatientAppointmentPerDay: jest.fn(),
    createAppointmentCOD: jest.fn(),
    createPaymentRequestOnline: jest.fn(),
    createAppointmentOutOfHours: jest.fn(),
    resolveSessionAppointmentStartTime: jest.fn(),
    appointmentWebhookService: {
      sendConfirmation: jest.fn().mockResolvedValue(undefined),
    },
    parseBookingExtraHour: jest.fn(),
    APPOINTMENT_CONFLICT_MESSAGE:
      'You already have a confirmed appointment at this time. Please select a different time slot.',
    ONE_APPOINTMENT_PER_DAY_MESSAGE:
      'You have an appointment scheduled for this day. You can only book one appointment per day.',
    APPOINTMENT_CONFLICT_EXCLUDED_STATUSES: ['CANCELLED', 'COMPLETED'],
    RESCHEDULE_APPOINTMENT_CONFLICT_MESSAGE:
      'You already have a confirmed appointment at this new time. Please select a different time slot.',
  });

  it('UT-20-PAT-01: Create standard appointment successfully with COD.', async () => {
    const appointmentsService = {
      createAppointmentFromSession: jest.fn().mockResolvedValue({
        appointment_id: 'appointment-1',
        payment_type: 'cod',
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
      },
    });
  });

  it('UT-20-PAT-02: Create standard appointment and receive online payment request.', async () => {
    const appointmentsService = {
      createAppointmentFromSession: jest.fn().mockResolvedValue({
        message: 'Please complete the payment to finish booking',
        data: { amount: 200000 },
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
        session_id: '550e8400-e29b-41d4-a716-446655440004',
      }),
    );

    expect(appointmentsService.createAppointmentFromSession).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440004',
      'patient-1',
    );
    expect(result.message).toBe('Please complete the payment to finish booking');
  });

  it('UT-20-PAT-03: Reject missing or invalid JWT.', () => {
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

  it('UT-20-PAT-04: Reject invalid or expired session id.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.bookingSessionService.getSession.mockRejectedValue(
      new NotFoundException('Session not found or expired'),
    );

    await expect(
      AppointmentsService.prototype.createAppointmentFromSession.call(
        serviceContext,
        '550e8400-e29b-41d4-a716-446655440002',
        'patient-1',
      ),
    ).rejects.toThrow(new NotFoundException('Session not found or expired'));
  });

  it('UT-20-PAT-05: Reject session ownership mismatch.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.bookingSessionService.getSession.mockResolvedValue(
      createStandardSession({ patientId: 'patient-2' }),
    );

    await expect(
      AppointmentsService.prototype.createAppointmentFromSession.call(
        serviceContext,
        '550e8400-e29b-41d4-a716-446655440003',
        'patient-1',
      ),
    ).rejects.toThrow(
      new ForbiddenException('You do not have permission to access this session'),
    );
  });

  it('UT-20-PAT-06: Reject missing payment method or incomplete standard session.', async () => {
    const missingPaymentContext = createServiceContext();
    missingPaymentContext.bookingSessionService.getSession.mockResolvedValue(
      createStandardSession({ paymentMethod: null }),
    );

    await expect(
      AppointmentsService.prototype.createAppointmentFromSession.call(
        missingPaymentContext,
        'session-1',
        'patient-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Payment method not found in booking session. Please restart the booking process.',
      ),
    );

    const incompleteContext = createServiceContext();
    incompleteContext.bookingSessionService.getSession.mockResolvedValue(
      createStandardSession({ clinicShiftHourId: null }),
    );

    await expect(
      AppointmentsService.prototype.createAppointmentFromSession.call(
        incompleteContext,
        'session-1',
        'patient-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Incomplete booking session. Please complete all steps (including payment method selection) before confirming.',
      ),
    );
  });

  it('UT-20-PAT-07: Reject invalid business rules for date, slot, doctor, or services.', async () => {
    const pastDateContext = createServiceContext();
    pastDateContext.bookingSessionService.getSession.mockResolvedValue(
      createStandardSession({ appointmentDate: '2000-01-01' }),
    );

    await expect(
      AppointmentsService.prototype.createAppointmentFromSession.call(
        pastDateContext,
        'session-1',
        'patient-1',
      ),
    ).rejects.toThrow(
      new BadRequestException('Appointment date must be today or in the future'),
    );

    const futureDateContext = createServiceContext();
    futureDateContext.bookingSessionService.getSession.mockResolvedValue(
      createStandardSession({ appointmentDate: '2200-01-01' }),
    );

    await expect(
      AppointmentsService.prototype.createAppointmentFromSession.call(
        futureDateContext,
        'session-2',
        'patient-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Appointment date cannot be more than 60 days in the future',
      ),
    );
  });

  it('UT-20-PAT-08: Reject duplicate same-time appointment.', async () => {
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
        new Date('2099-01-10T09:00:00.000Z'),
      ),
    ).rejects.toThrow(
      new ConflictException(
        'You already have a confirmed appointment at this time. Please select a different time slot.',
      ),
    );
  });

  it('UT-20-PAT-09: Reject one-appointment-per-day rule.', async () => {
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
        '2099-01-10',
      ),
    ).rejects.toThrow(
      new ConflictException(
        'You have an appointment scheduled for this day. You can only book one appointment per day.',
      ),
    );
  });

  it('UT-20-PAT-10: Reject invalid session_id DTO input.', async () => {
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
