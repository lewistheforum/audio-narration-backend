import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { StaffCreateAppointmentDto } from '../../../../src/modules/appointments/dto/staff-create-appointment.dto';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums/appointment-status.enum';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-27 Create Walk-in Appointment', () => {
  const createDto = () =>
    plainToInstance(StaffCreateAppointmentDto, {
      patientId: '550e8400-e29b-41d4-a716-446655440000',
      clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440001',
      appointmentDate: '2026-04-10',
      doctorId: '550e8400-e29b-41d4-a716-446655440003',
      patientNote: 'Walk-in patient',
      services: [
        { clinicServiceId: '550e8400-e29b-41d4-a716-446655440002' },
      ],
    });

  const createServiceContext = () => ({
    accountRepository: {
      findAccountById: jest.fn().mockResolvedValue({
        _id: 'staff-1',
        role: AccountRole.CLINIC_STAFF,
        parentId: 'clinic-1',
      }),
    },
    getAppointmentHourFromShift: jest
      .fn()
      .mockResolvedValue(new Date('2026-04-10T08:00:00.000Z')),
    validateShiftHourCapacity: jest.fn().mockResolvedValue(undefined),
    checkPatientAppointmentPerDay: jest.fn().mockResolvedValue(undefined),
    transformToResponseDto: jest.fn().mockImplementation((appointment) => appointment),
    dataSource: {
      transaction: jest.fn(),
    },
  });

  it('UT-27-01: Successful walk-in registration for existing patient by CLINIC_STAFF.', async () => {
    const appointmentsService = {
      staffCreateAppointment: jest.fn().mockResolvedValue({ _id: 'appointment-1' }),
    };
    const controller = new AppointmentsController(
      appointmentsService as any,
      {} as any,
      {} as any,
    );
    const dto = createDto();

    await controller.staffCreateAppointment({ user: { _id: 'staff-1' } }, dto);

    expect(appointmentsService.staffCreateAppointment).toHaveBeenCalledWith('staff-1', dto);
  });

  it('UT-27-02: Unauthorized access — missing, empty, expired JWT or non-STAFF role.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.staffCreateAppointment,
    );
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.staffCreateAppointment,
    );

    expect(guards).toHaveLength(2);
    expect(roles).toEqual([AccountRole.CLINIC_STAFF]);
  });

  it('UT-27-03: Staff account not found or missing parentId.', async () => {
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
        createDto(),
      ),
    ).rejects.toThrow(new NotFoundException('Account not found'));
  });

  it('UT-27-04: Patient already has active appointment in same shift/date.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.dataSource.transaction.mockImplementation(async (callback: any) => {
      const duplicateBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ _id: 'appointment-2' }),
      };
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(duplicateBuilder),
      };
      return callback(manager);
    });

    await expect(
      AppointmentsService.prototype.staffCreateAppointment.call(
        serviceContext,
        'staff-1',
        createDto(),
      ),
    ).rejects.toThrow(
      new ConflictException(
        'Patient already has an active appointment in this shift on the selected date.',
      ),
    );
  });

  it('UT-27-05: One or more services not found or inactive for clinic.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.dataSource.transaction.mockImplementation(async (callback: any) => {
      const duplicateBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      const servicesBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      const manager = {
        createQueryBuilder: jest
          .fn()
          .mockReturnValueOnce(duplicateBuilder)
          .mockReturnValueOnce(servicesBuilder),
      };
      return callback(manager);
    });

    await expect(
      AppointmentsService.prototype.staffCreateAppointment.call(
        serviceContext,
        'staff-1',
        createDto(),
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'One or more services not found or inactive for this clinic. Expected 1 services, found 0',
      ),
    );
  });

  it('UT-27-06: Missing required fields (patientId, clinicShiftHourId, appointmentDate, services).', async () => {
    const missingPatientErrors = await validate(
      plainToInstance(StaffCreateAppointmentDto, {
        clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440001',
        appointmentDate: '2026-04-10',
        services: [{ clinicServiceId: '550e8400-e29b-41d4-a716-446655440002' }],
      }),
    );
    const missingShiftErrors = await validate(
      plainToInstance(StaffCreateAppointmentDto, {
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        appointmentDate: '2026-04-10',
        services: [{ clinicServiceId: '550e8400-e29b-41d4-a716-446655440002' }],
      }),
    );
    const missingServicesErrors = await validate(
      plainToInstance(StaffCreateAppointmentDto, {
        patientId: '550e8400-e29b-41d4-a716-446655440000',
        clinicShiftHourId: '550e8400-e29b-41d4-a716-446655440001',
        appointmentDate: '2026-04-10',
        services: [],
      }),
    );

    const messages = [
      ...missingPatientErrors,
      ...missingShiftErrors,
      ...missingServicesErrors,
    ].flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain('Patient ID is required');
    expect(messages).toContain('Clinic shift hour ID is required');
    expect(messages).toContain('At least one service is required');
  });

  it('UT-27-07: Patient already has one appointment per day (strict check).', async () => {
    const serviceContext = createServiceContext();
    serviceContext.checkPatientAppointmentPerDay.mockRejectedValue(
      new BadRequestException('Patient already has an appointment on this date.'),
    );
    serviceContext.dataSource.transaction.mockImplementation(async (callback: any) => {
      const duplicateBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      const manager = {
        createQueryBuilder: jest.fn().mockReturnValue(duplicateBuilder),
      };
      return callback(manager);
    });

    await expect(
      AppointmentsService.prototype.staffCreateAppointment.call(
        serviceContext,
        'staff-1',
        createDto(),
      ),
    ).rejects.toThrow(
      new BadRequestException('Patient already has an appointment on this date.'),
    );
  });

  it('UT-27-08: Slot capacity at limit (validateShiftHourCapacity throws).', async () => {
    const serviceContext = createServiceContext();
    serviceContext.validateShiftHourCapacity.mockRejectedValue(
      new ConflictException('This time slot is fully booked. Please select another time.'),
    );

    await expect(
      AppointmentsService.prototype.staffCreateAppointment.call(
        serviceContext,
        'staff-1',
        createDto(),
      ),
    ).rejects.toThrow(
      new ConflictException('This time slot is fully booked. Please select another time.'),
    );
  });
});
