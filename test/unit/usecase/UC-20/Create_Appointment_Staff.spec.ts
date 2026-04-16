import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { StaffCreateAppointmentDto } from '../../../../src/modules/appointments/dto/staff-create-appointment.dto';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-20 Create Appointment Staff', () => {
  const validPayload = {
    patientId: '550e8400-e29b-41d4-a716-446655440000',
    clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440001',
    appointmentDate: '2026-04-10',
    services: [
      { clinicServiceId: '550e8400-e29b-41d4-a716-446655440010' },
    ],
    total: 200000,
  };

  const createBuilder = (terminal: Record<string, any>) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(terminal.getOne ?? null),
    getRawMany: jest.fn().mockResolvedValue(terminal.getRawMany ?? []),
  });

  const createManager = ({
    duplicatedAppointment = null,
    serviceConfigs = [
      { id: validPayload.services[0].clinicServiceId, price: '200000', discount: '10' },
    ],
    servicesRaw = [
      {
        id: validPayload.services[0].clinicServiceId,
        servicename: 'General Consultation',
        description: 'Consultation',
        price: '200000',
        discount: '10',
      },
    ],
    clinicRooms = [],
  } = {}) => {
    const builders = [
      createBuilder({ getOne: duplicatedAppointment }),
      createBuilder({ getRawMany: serviceConfigs }),
      createBuilder({ getRawMany: servicesRaw }),
      createBuilder({ getRawMany: clinicRooms }),
    ];

    return {
      createQueryBuilder: jest.fn(() => builders.shift()),
      create: jest.fn((_entity: unknown, payload: any) => ({ ...payload, _id: payload._id ?? 'generated-id' })),
      save: jest.fn(async (_entity: unknown, payload: any) => {
        if (Array.isArray(payload)) return payload;
        return { _id: payload._id ?? 'saved-id', ...payload };
      }),
      findOne: jest.fn().mockResolvedValue({
        _id: 'appointment-1',
        clinicShiftHourId: validPayload.clinicShiftHourId,
        doctorId: '550e8400-e29b-41d4-a716-446655440003',
        appointmentDate: validPayload.appointmentDate,
      }),
    };
  };

  const createServiceContext = () => ({
    accountRepository: {
      findAccountById: jest.fn(),
    },
    getAppointmentHourFromShift: jest.fn().mockResolvedValue(
      new Date('2026-04-10T09:00:00.000Z'),
    ),
    validateShiftHourCapacity: jest.fn(),
    checkPatientAppointmentPerDay: jest.fn(),
    transformToResponseDto: jest.fn().mockReturnValue({
      id: 'appointment-1',
      total: 180000,
    }),
    dataSource: {
      transaction: jest.fn(),
    },
  });

  const validateDto = (payload: Record<string, unknown>) =>
    validate(plainToInstance(StaffCreateAppointmentDto, payload));

  const collectMessages = (errors: any[]): string[] =>
    errors.flatMap((error) => [
      ...(Object.values(error.constraints ?? {}) as string[]),
      ...collectMessages(error.children ?? []),
    ]);

  it('UT-20-STAFF-01: Create appointment successfully with minimal valid payload.', async () => {
    const appointmentsService = {
      staffCreateAppointment: jest.fn().mockResolvedValue({ id: 'appointment-1' }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );

    const result = await controller.staffCreateAppointment(
      { user: { _id: 'staff-1' } },
      plainToInstance(StaffCreateAppointmentDto, validPayload),
    );

    expect(appointmentsService.staffCreateAppointment).toHaveBeenCalledWith(
      'staff-1',
      expect.objectContaining({ patientId: validPayload.patientId }),
    );
    expect(result).toEqual({ id: 'appointment-1' });
  });

  it('UT-20-STAFF-02: Create appointment successfully with optional doctor note and auto-calculated total.', async () => {
    const serviceContext = createServiceContext();
    const manager = createManager({ clinicRooms: [{ roomId: 'room-1', roomName: 'Room 1' }] });
    serviceContext.accountRepository.findAccountById.mockResolvedValue({
      _id: 'staff-1',
      role: AccountRole.CLINIC_STAFF,
      parentId: 'clinic-1',
    });
    serviceContext.dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    const result = await AppointmentsService.prototype.staffCreateAppointment.call(
      serviceContext,
      'staff-1',
      plainToInstance(StaffCreateAppointmentDto, {
        ...validPayload,
        doctorId: '550e8400-e29b-41d4-a716-446655440003',
        appointmentHour: '2026-04-10T09:00:00.000Z',
        patientNote: 'Patient has back pain',
      }),
    );

    expect(serviceContext.validateShiftHourCapacity).toHaveBeenCalled();
    expect(serviceContext.transformToResponseDto).toHaveBeenCalled();
    expect(result).toEqual({ id: 'appointment-1', total: 180000 });
  });

  it('UT-20-STAFF-03: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.staffCreateAppointment,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-20-STAFF-04: Reject non-staff role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.staffCreateAppointment,
    );

    expect(roles).toEqual([AccountRole.CLINIC_STAFF]);
  });

  it('UT-20-STAFF-05: Reject missing staff clinic assignment.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findAccountById.mockResolvedValue({
      _id: 'staff-1',
      role: AccountRole.CLINIC_STAFF,
      parentId: null,
    });

    await expect(
      AppointmentsService.prototype.staffCreateAppointment.call(
        serviceContext,
        'staff-1',
        plainToInstance(StaffCreateAppointmentDto, validPayload),
      ),
    ).rejects.toThrow(new NotFoundException('Account not found'));
  });

  it('UT-20-STAFF-06: Reject invalid required DTO fields.', async () => {
    const missingPatientErrors = await validateDto({
      ...validPayload,
      patientId: null,
    });
    const invalidDoctorErrors = await validateDto({
      ...validPayload,
      doctorId: 'invalid_uuid',
    });
    const missingShiftErrors = await validateDto({
      ...validPayload,
      clinicShiftHourId: null,
    });
    const invalidDateErrors = await validateDto({
      ...validPayload,
      appointmentDate: 'not-a-date',
    });
    const invalidServiceErrors = await validateDto({
      ...validPayload,
      services: [{ clinicServiceId: 'invalid_uuid' }],
    });

    const messages = collectMessages([
      ...missingPatientErrors,
      ...invalidDoctorErrors,
      ...missingShiftErrors,
      ...invalidDateErrors,
      ...invalidServiceErrors,
    ]);

    expect(messages).toContain('Patient ID is required');
    expect(messages).toContain('Invalid doctor ID format');
    expect(messages).toContain('Clinic shift hour ID is required');
    expect(messages).toContain('Invalid date format. Use YYYY-MM-DD');
    expect(messages).toContain(
      'Service ID must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)',
    );
  });

  it('UT-20-STAFF-07: Reject duplicate same-shift booking.', async () => {
    const serviceContext = createServiceContext();
    const manager = createManager({ duplicatedAppointment: { _id: 'appointment-existing' } });
    serviceContext.accountRepository.findAccountById.mockResolvedValue({
      _id: 'staff-1',
      role: AccountRole.CLINIC_STAFF,
      parentId: 'clinic-1',
    });
    serviceContext.dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    await expect(
      AppointmentsService.prototype.staffCreateAppointment.call(
        serviceContext,
        'staff-1',
        plainToInstance(StaffCreateAppointmentDto, validPayload),
      ),
    ).rejects.toThrow(
      new ConflictException(
        'Patient already has an active appointment in this shift on the selected date.',
      ),
    );
  });

  it('UT-20-STAFF-08: Reject inactive or missing service config.', async () => {
    const serviceContext = createServiceContext();
    const manager = createManager({ serviceConfigs: [] });
    serviceContext.accountRepository.findAccountById.mockResolvedValue({
      _id: 'staff-1',
      role: AccountRole.CLINIC_STAFF,
      parentId: 'clinic-1',
    });
    serviceContext.dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    await expect(
      AppointmentsService.prototype.staffCreateAppointment.call(
        serviceContext,
        'staff-1',
        plainToInstance(StaffCreateAppointmentDto, validPayload),
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'One or more services not found or inactive for this clinic. Expected 1 services, found 0',
      ),
    );
  });

  it('UT-20-STAFF-09: Reject one-appointment-per-day rule.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findAccountById.mockResolvedValue({
      _id: 'staff-1',
      role: AccountRole.CLINIC_STAFF,
      parentId: 'clinic-1',
    });
    serviceContext.checkPatientAppointmentPerDay.mockRejectedValue(
      new ConflictException(
        'You have an appointment scheduled for this day. You can only book one appointment per day.',
      ),
    );
    serviceContext.dataSource.transaction.mockImplementation(async (cb: any) => cb(createManager()));

    await expect(
      AppointmentsService.prototype.staffCreateAppointment.call(
        serviceContext,
        'staff-1',
        plainToInstance(StaffCreateAppointmentDto, validPayload),
      ),
    ).rejects.toThrow(
      new ConflictException(
        'You have an appointment scheduled for this day. You can only book one appointment per day.',
      ),
    );
  });

  it('UT-20-STAFF-10: Accept booking when total is omitted.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findAccountById.mockResolvedValue({
      _id: 'staff-1',
      role: AccountRole.CLINIC_STAFF,
      parentId: 'clinic-1',
    });
    serviceContext.dataSource.transaction.mockImplementation(async (cb: any) => cb(createManager()));

    const result = await AppointmentsService.prototype.staffCreateAppointment.call(
      serviceContext,
      'staff-1',
      plainToInstance(StaffCreateAppointmentDto, {
        ...validPayload,
        total: undefined,
      }),
    );

    expect(result).toEqual({ id: 'appointment-1', total: 180000 });
  });

  it('UT-20-STAFF-11: Reject note length above 1000.', async () => {
    const validationErrors = await validateDto({
      ...validPayload,
      patientNote: 'A'.repeat(1001),
    });
    const messages = collectMessages(validationErrors);

    expect(messages).toContain('Patient note must not exceed 1000 characters');
  });
});
