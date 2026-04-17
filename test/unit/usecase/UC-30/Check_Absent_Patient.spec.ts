import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums/appointment-status.enum';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-30 Check Absent Patient', () => {
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

  it('UT-30-01: Mark PENDING or CONFIRMED appointment absent successfully.', async () => {
    const pendingContext = createContext(AppointmentStatus.PENDING);
    const confirmedContext = createContext(AppointmentStatus.CONFIRMED);

    const pendingResult = await AppointmentsService.prototype.markAppointmentAbsent.call(
      pendingContext,
      'appointment-1',
    );
    const confirmedResult = await AppointmentsService.prototype.markAppointmentAbsent.call(
      confirmedContext,
      'appointment-1',
    );

    expect(pendingResult.status).toBe(AppointmentStatus.ABSENT);
    expect(confirmedResult.status).toBe(AppointmentStatus.ABSENT);
  });

  it('UT-30-02: Mark CHECKED_IN appointment absent successfully.', async () => {
    const serviceContext = createContext(AppointmentStatus.CHECKED_IN);

    const result = await AppointmentsService.prototype.markAppointmentAbsent.call(
      serviceContext,
      'appointment-1',
    );

    expect(result.status).toBe(AppointmentStatus.ABSENT);
  });

  it('UT-30-03: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.markAppointmentAbsent,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-30-04: Reject authenticated non-staff role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.markAppointmentAbsent,
    );

    expect(roles).toEqual([AccountRole.CLINIC_STAFF]);
  });

  it('UT-30-05: Reject missing appointment.', async () => {
    const serviceContext = createContext(null);

    await expect(
      AppointmentsService.prototype.markAppointmentAbsent.call(
        serviceContext,
        'missing-appointment',
      ),
    ).rejects.toThrow(new NotFoundException('Appointment not found.'));
  });

  it('UT-30-06: Reject already ABSENT appointment.', async () => {
    const serviceContext = createContext(AppointmentStatus.ABSENT);

    await expect(
      AppointmentsService.prototype.markAppointmentAbsent.call(
        serviceContext,
        'appointment-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot mark appointment as absent with status "ABSENT". Only pending (PENDING) or confirmed (CONFIRMED) or CHECKED IN appointments can be marked absent.',
      ),
    );
  });

  it('UT-30-07: Reject COMPLETED or CANCELLED appointment.', async () => {
    const completedContext = createContext(AppointmentStatus.COMPLETED);
    const cancelledContext = createContext(AppointmentStatus.CANCELLED);

    await expect(
      AppointmentsService.prototype.markAppointmentAbsent.call(
        completedContext,
        'appointment-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot mark appointment as absent with status "COMPLETED". Only pending (PENDING) or confirmed (CONFIRMED) or CHECKED IN appointments can be marked absent.',
      ),
    );
    await expect(
      AppointmentsService.prototype.markAppointmentAbsent.call(
        cancelledContext,
        'appointment-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot mark appointment as absent with status "CANCELLED". Only pending (PENDING) or confirmed (CONFIRMED) or CHECKED IN appointments can be marked absent.',
      ),
    );
  });

  it('UT-30-08: Reject IN_PROGRESS appointment.', async () => {
    const serviceContext = createContext(AppointmentStatus.IN_PROGRESS);

    await expect(
      AppointmentsService.prototype.markAppointmentAbsent.call(
        serviceContext,
        'appointment-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot mark appointment as absent with status "IN_PROGRESS". Only pending (PENDING) or confirmed (CONFIRMED) or CHECKED IN appointments can be marked absent.',
      ),
    );
  });
});
