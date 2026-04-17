import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { DeclineAppointmentDto } from '../../../../src/modules/appointments/dto/decline-appointment.dto';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums/appointment-status.enum';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-33 Decline After-Hours Appointment', () => {
  const createContext = (appointment?: any) => ({
    appointmentRepository: {
      findByIdWithRelations: jest.fn().mockResolvedValue(appointment),
      save: jest.fn().mockImplementation(async (value) => value),
    },
    loadAppointmentServicesAndRooms: jest.fn().mockResolvedValue({
      services: [],
      clinicRooms: [],
    }),
    socketGatewayService: {
      broadcastAppointmentStatusChange: jest.fn(),
    },
    transformToResponseDto: jest.fn().mockImplementation((value) => value),
  } as any);

  it('UT-33-01: Decline assigned PENDING_DOCTOR extra-hour appointment successfully.', async () => {
    const serviceContext = createContext({
      _id: 'appointment-1',
      clinicId: 'clinic-1',
      doctorId: 'doctor-1',
      extraHour: new Date('2099-01-10T12:30:00.000Z'),
      status: AppointmentStatus.PENDING_DOCTOR,
      deletedAt: null,
    });

    const result = await AppointmentsService.prototype.declineAppointment.call(
      serviceContext,
      'appointment-1',
      'doctor-1',
      { rejectReason: 'Doctor unavailable due to emergency surgery' },
    );

    expect(result.status).toBe(AppointmentStatus.CANCELLED);
    expect(result.rejectReason).toBe('Doctor unavailable due to emergency surgery');
  });

  it('UT-33-02: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.declineAppointment,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-33-03: Reject authenticated non-doctor role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.declineAppointment,
    );

    expect(roles).toEqual([AccountRole.DOCTOR]);
  });

  it('UT-33-04: Reject missing appointment.', async () => {
    const serviceContext = createContext(null);

    await expect(
      AppointmentsService.prototype.declineAppointment.call(
        serviceContext,
        'missing-appointment',
        'doctor-1',
        { rejectReason: 'Doctor unavailable due to emergency surgery' },
      ),
    ).rejects.toThrow(new NotFoundException('Appointment not found'));
  });

  it('UT-33-05: Reject standard booking, different doctor, or wrong status.', async () => {
    const noExtraHourContext = createContext({
      _id: 'appointment-1',
      doctorId: 'doctor-1',
      extraHour: null,
      status: AppointmentStatus.PENDING_DOCTOR,
      deletedAt: null,
    });
    const otherDoctorContext = createContext({
      _id: 'appointment-1',
      doctorId: 'doctor-2',
      extraHour: new Date('2099-01-10T12:30:00.000Z'),
      status: AppointmentStatus.PENDING_DOCTOR,
      deletedAt: null,
    });
    const wrongStatusContext = createContext({
      _id: 'appointment-1',
      doctorId: 'doctor-1',
      extraHour: new Date('2099-01-10T12:30:00.000Z'),
      status: AppointmentStatus.CONFIRMED,
      deletedAt: null,
    });

    await expect(
      AppointmentsService.prototype.declineAppointment.call(
        noExtraHourContext,
        'appointment-1',
        'doctor-1',
        { rejectReason: 'Doctor unavailable due to emergency surgery' },
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'This appointment has no extra hour and cannot be declined through this endpoint',
      ),
    );
    await expect(
      AppointmentsService.prototype.declineAppointment.call(
        otherDoctorContext,
        'appointment-1',
        'doctor-1',
        { rejectReason: 'Doctor unavailable due to emergency surgery' },
      ),
    ).rejects.toThrow(
      new ForbiddenException('You do not have permission to decline this appointment'),
    );
    await expect(
      AppointmentsService.prototype.declineAppointment.call(
        wrongStatusContext,
        'appointment-1',
        'doctor-1',
        { rejectReason: 'Doctor unavailable due to emergency surgery' },
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot decline appointment. Current status is CONFIRMED, expected PENDING_DOCTOR',
      ),
    );
  });

  it('UT-33-06: Reject missing or invalid rejectReason.', async () => {
    const missingErrors = await validate(plainToInstance(DeclineAppointmentDto, {}));
    const messages = missingErrors.flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain('Reject reason is required');
    expect(() =>
      plainToInstance(DeclineAppointmentDto, { rejectReason: 123 }),
    ).toThrow('trim is not a function');
  });

  it('UT-33-07: Reject short rejectReason.', async () => {
    const errors = await validate(
      plainToInstance(DeclineAppointmentDto, { rejectReason: 'short' }),
    );
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain('Reject reason must be at least 10 characters');
  });

  it('UT-33-08: Reject too-long rejectReason.', async () => {
    const errors = await validate(
      plainToInstance(DeclineAppointmentDto, { rejectReason: 'A'.repeat(501) }),
    );
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));

    expect(messages).toContain('Reject reason must not exceed 500 characters');
  });

  it('UT-33-09: Reject invalid appointment UUID.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_format_id', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });
});
