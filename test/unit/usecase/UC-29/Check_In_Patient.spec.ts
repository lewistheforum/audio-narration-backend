import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums/appointment-status.enum';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-29 Check In Patient', () => {
  const createContext = (status?: AppointmentStatus | null) => ({
    appointmentRepository: {
      findByIdWithRelations: jest.fn().mockResolvedValue(
        status === null
          ? null
          : {
              _id: 'appointment-1',
              clinicId: 'clinic-1',
              status,
              deletedAt: null,
            },
      ),
      save: jest.fn().mockImplementation(async (appointment) => appointment),
    },
    loadAppointmentServicesAndRooms: jest.fn().mockResolvedValue({
      services: [],
      clinicRooms: [],
    }),
    socketGatewayService: {
      broadcastAppointmentStatusChange: jest.fn(),
    },
    transformToResponseDto: jest.fn().mockImplementation((appointment) => appointment),
  } as any);

  it('UT-29-01: Check in PENDING appointment successfully.', async () => {
    const serviceContext = createContext(AppointmentStatus.PENDING);

    const result = await AppointmentsService.prototype.checkInPatient.call(
      serviceContext,
      'appointment-1',
    );

    expect(result.status).toBe(AppointmentStatus.CHECKED_IN);
  });

  it('UT-29-02: Check in CONFIRMED or ABSENT appointment successfully.', async () => {
    const confirmedContext = createContext(AppointmentStatus.CONFIRMED);
    const absentContext = createContext(AppointmentStatus.ABSENT);

    const confirmedResult = await AppointmentsService.prototype.checkInPatient.call(
      confirmedContext,
      'appointment-1',
    );
    const absentResult = await AppointmentsService.prototype.checkInPatient.call(
      absentContext,
      'appointment-1',
    );

    expect(confirmedResult.status).toBe(AppointmentStatus.CHECKED_IN);
    expect(absentResult.status).toBe(AppointmentStatus.CHECKED_IN);
  });

  it('UT-29-03: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.checkInPatient,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-29-04: Reject authenticated non-staff role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.checkInPatient,
    );

    expect(roles).toEqual([AccountRole.CLINIC_STAFF]);
  });

  it('UT-29-05: Reject missing appointment.', async () => {
    const serviceContext = createContext(null);

    await expect(
      AppointmentsService.prototype.checkInPatient.call(serviceContext, 'missing-appointment'),
    ).rejects.toThrow(new NotFoundException('Appointment not found.'));
  });

  it('UT-29-06: Reject already CHECKED_IN appointment.', async () => {
    const serviceContext = createContext(AppointmentStatus.CHECKED_IN);

    await expect(
      AppointmentsService.prototype.checkInPatient.call(serviceContext, 'appointment-1'),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot check in appointment with status "CHECKED_IN". Only pending (PENDING) or confirmed (CONFIRMED) appointments can be checked in.',
      ),
    );
  });

  it('UT-29-07: Reject COMPLETED or CANCELLED appointment.', async () => {
    const completedContext = createContext(AppointmentStatus.COMPLETED);
    const cancelledContext = createContext(AppointmentStatus.CANCELLED);

    await expect(
      AppointmentsService.prototype.checkInPatient.call(completedContext, 'appointment-1'),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot check in appointment with status "COMPLETED". Only pending (PENDING) or confirmed (CONFIRMED) appointments can be checked in.',
      ),
    );
    await expect(
      AppointmentsService.prototype.checkInPatient.call(cancelledContext, 'appointment-1'),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot check in appointment with status "CANCELLED". Only pending (PENDING) or confirmed (CONFIRMED) appointments can be checked in.',
      ),
    );
  });

  it('UT-29-08: Reject IN_PROGRESS appointment.', async () => {
    const serviceContext = createContext(AppointmentStatus.IN_PROGRESS);

    await expect(
      AppointmentsService.prototype.checkInPatient.call(serviceContext, 'appointment-1'),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot check in appointment with status "IN_PROGRESS". Only pending (PENDING) or confirmed (CONFIRMED) appointments can be checked in.',
      ),
    );
  });
});
