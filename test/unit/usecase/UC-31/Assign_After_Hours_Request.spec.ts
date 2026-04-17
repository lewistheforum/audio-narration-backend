import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums/appointment-status.enum';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-31 Assign After-Hours Request', () => {
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

  it('UT-31-01: Assign valid pending out-of-hours request successfully.', async () => {
    const serviceContext = createContext({
      _id: 'appointment-1',
      clinicId: 'clinic-1',
      status: AppointmentStatus.PENDING,
      extraHour: new Date('2099-01-10T12:30:00.000Z'),
      extraRoomId: 'room-1',
      deletedAt: null,
    });

    const result = await AppointmentsService.prototype.staffAssignToDoctor.call(
      serviceContext,
      'appointment-1',
    );

    expect(result.status).toBe(AppointmentStatus.PENDING_DOCTOR);
  });

  it('UT-31-02: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.staffAssignToDoctor,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-31-03: Reject authenticated non-staff role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.staffAssignToDoctor,
    );

    expect(roles).toEqual([AccountRole.CLINIC_STAFF]);
  });

  it('UT-31-04: Reject missing appointment.', async () => {
    const serviceContext = createContext(null);

    await expect(
      AppointmentsService.prototype.staffAssignToDoctor.call(serviceContext, 'missing-appointment'),
    ).rejects.toThrow(new NotFoundException('Appointment not found'));
  });

  it('UT-31-05: Reject non-pending status.', async () => {
    const serviceContext = createContext({
      _id: 'appointment-1',
      status: AppointmentStatus.PENDING_DOCTOR,
      extraHour: new Date('2099-01-10T12:30:00.000Z'),
      extraRoomId: 'room-1',
      deletedAt: null,
    });

    await expect(
      AppointmentsService.prototype.staffAssignToDoctor.call(serviceContext, 'appointment-1'),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot assign appointment to doctor. Current status is "PENDING_DOCTOR", expected "PENDING"',
      ),
    );
  });

  it('UT-31-06: Reject standard booking without extraHour.', async () => {
    const serviceContext = createContext({
      _id: 'appointment-1',
      status: AppointmentStatus.PENDING,
      extraHour: null,
      extraRoomId: 'room-1',
      deletedAt: null,
    });

    await expect(
      AppointmentsService.prototype.staffAssignToDoctor.call(serviceContext, 'appointment-1'),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot assign to doctor: appointment does not have extra_hour (out-of-hours request)',
      ),
    );
  });

  it('UT-31-07: Reject missing extraRoomId.', async () => {
    const serviceContext = createContext({
      _id: 'appointment-1',
      status: AppointmentStatus.PENDING,
      extraHour: new Date('2099-01-10T12:30:00.000Z'),
      extraRoomId: null,
      deletedAt: null,
    });

    await expect(
      AppointmentsService.prototype.staffAssignToDoctor.call(serviceContext, 'appointment-1'),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot assign to doctor: appointment must have an extra room assigned first',
      ),
    );
  });
});
