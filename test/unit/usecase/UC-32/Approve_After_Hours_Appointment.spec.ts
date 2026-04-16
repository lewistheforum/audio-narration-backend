import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums/appointment-status.enum';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-32 Approve After-Hours Appointment', () => {
  const createContext = (appointment?: any) => ({
    appointmentRepository: {
      findByIdWithRelations: jest.fn().mockResolvedValue(appointment),
      save: jest.fn().mockImplementation(async (value) => value),
      findByIdWithCompleteDetails: jest.fn().mockResolvedValue(null),
    },
    loadAppointmentServicesAndRooms: jest.fn().mockResolvedValue({
      services: [],
      clinicRooms: [],
    }),
    socketGatewayService: {
      broadcastAppointmentStatusChange: jest.fn(),
    },
    mailerService: {
      sendAppointmentConfirmedEmail: jest.fn(),
    },
    logger: {
      error: jest.fn(),
    },
    transformToResponseDto: jest.fn().mockImplementation((value) => value),
  } as any);

  it('UT-32-01: Approve assigned PENDING_DOCTOR extra-hour appointment successfully.', async () => {
    const serviceContext = createContext({
      _id: 'appointment-1',
      clinicId: 'clinic-1',
      doctorId: 'doctor-1',
      extraHour: new Date('2099-01-10T12:30:00.000Z'),
      status: AppointmentStatus.PENDING_DOCTOR,
      deletedAt: null,
    });

    const result = await AppointmentsService.prototype.acceptAppointment.call(
      serviceContext,
      'appointment-1',
      'doctor-1',
      {},
    );

    expect(result.status).toBe(AppointmentStatus.CONFIRMED);
  });

  it('UT-32-02: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.acceptAppointment,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-32-03: Reject authenticated non-doctor role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.acceptAppointment,
    );

    expect(roles).toEqual([AccountRole.DOCTOR]);
  });

  it('UT-32-04: Reject missing appointment.', async () => {
    const serviceContext = createContext(null);

    await expect(
      AppointmentsService.prototype.acceptAppointment.call(
        serviceContext,
        'missing-appointment',
        'doctor-1',
        {},
      ),
    ).rejects.toThrow(new NotFoundException('Appointment not found'));
  });

  it('UT-32-05: Reject standard appointment without extraHour.', async () => {
    const serviceContext = createContext({
      _id: 'appointment-1',
      doctorId: 'doctor-1',
      extraHour: null,
      status: AppointmentStatus.PENDING_DOCTOR,
      deletedAt: null,
    });

    await expect(
      AppointmentsService.prototype.acceptAppointment.call(
        serviceContext,
        'appointment-1',
        'doctor-1',
        {},
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'This appointment has no extra hour and cannot be accepted through this endpoint',
      ),
    );
  });

  it('UT-32-06: Reject doctor ownership mismatch.', async () => {
    const serviceContext = createContext({
      _id: 'appointment-1',
      doctorId: 'doctor-2',
      extraHour: new Date('2099-01-10T12:30:00.000Z'),
      status: AppointmentStatus.PENDING_DOCTOR,
      deletedAt: null,
    });

    await expect(
      AppointmentsService.prototype.acceptAppointment.call(
        serviceContext,
        'appointment-1',
        'doctor-1',
        {},
      ),
    ).rejects.toThrow(
      new ForbiddenException('You do not have permission to accept this appointment'),
    );
  });

  it('UT-32-07: Reject wrong appointment status.', async () => {
    const pendingContext = createContext({
      _id: 'appointment-1',
      doctorId: 'doctor-1',
      extraHour: new Date('2099-01-10T12:30:00.000Z'),
      status: AppointmentStatus.PENDING,
      deletedAt: null,
    });
    const cancelledContext = createContext({
      _id: 'appointment-1',
      doctorId: 'doctor-1',
      extraHour: new Date('2099-01-10T12:30:00.000Z'),
      status: AppointmentStatus.CANCELLED,
      deletedAt: null,
    });

    await expect(
      AppointmentsService.prototype.acceptAppointment.call(
        pendingContext,
        'appointment-1',
        'doctor-1',
        {},
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot accept appointment. Current status is PENDING, expected PENDING_DOCTOR',
      ),
    );
    await expect(
      AppointmentsService.prototype.acceptAppointment.call(
        cancelledContext,
        'appointment-1',
        'doctor-1',
        {},
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot accept appointment. Current status is CANCELLED, expected PENDING_DOCTOR',
      ),
    );
  });
});
