import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { PatientCancelAppointmentDto } from '../../../../src/modules/appointments/dto/patient-cancel-appointment.dto';
import { StaffCancelAppointmentDto } from '../../../../src/modules/appointments/dto/staff-cancel-appointment.dto';
import { AppointmentPackageStatus } from '../../../../src/modules/appointments/enums/appointment-package-status.enum';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums/appointment-status.enum';
import { PaymentType } from '../../../../src/modules/appointments/enums/payment-type.enum';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-25 Cancel Appointment', () => {
  const createAppointment = (overrides: Record<string, unknown> = {}) => ({
    _id: 'appointment-1',
    patientId: 'patient-1',
    clinicId: 'clinic-1',
    status: AppointmentStatus.PENDING,
    patientNote: null,
    deletedAt: null,
    ...overrides,
  });

  const createServiceContext = (options?: {
    appointment?: any;
    packages?: any[];
  }) => {
    const appointment =
      options && 'appointment' in options
        ? options.appointment
        : createAppointment();
    const packages = options?.packages ?? [];
    const packageRepository = {
      find: jest.fn().mockResolvedValue(packages),
      save: jest.fn().mockResolvedValue(packages),
    };

    return {
      appointmentRepository: {
        findByIdWithRelations: jest.fn().mockResolvedValue(appointment),
        save: jest.fn().mockImplementation(async (value) => value),
        findByIdWithCompleteDetails: jest.fn().mockResolvedValue(null),
      },
      dataSource: {
        getRepository: jest.fn().mockReturnValue(packageRepository),
      },
      loadAppointmentServicesAndRooms: jest.fn().mockResolvedValue({
        services: [],
        clinicRooms: [],
      }),
      transformToResponseDto: jest.fn().mockImplementation((value) => value),
      socketGatewayService: {
        broadcastAppointmentStatusChange: jest.fn(),
      },
      mailerService: {
        sendAppointmentCancelledEmail: jest.fn(),
      },
      logger: {
        error: jest.fn(),
      },
    } as any;
  };

  it('UT-25-01: Patient cancels own appointment successfully.', async () => {
    const serviceContext = createServiceContext({
      packages: [
        {
          paymentType: PaymentType.COD,
          status: AppointmentPackageStatus.PENDING_PAYMENT,
        },
      ],
    });

    const result = await AppointmentsService.prototype.patientCancelAppointment.call(
      serviceContext,
      'appointment-1',
      'patient-1',
      { patientNote: 'Patient requested cancellation' },
    );

    expect(result.status).toBe(AppointmentStatus.CANCELLED);
    expect(result.patientNote).toBe('Patient requested cancellation');
  });

  it('UT-25-02: Staff cancels appointment successfully including CHECKED_IN status.', async () => {
    const serviceContext = createServiceContext({
      appointment: createAppointment({ status: AppointmentStatus.CHECKED_IN }),
      packages: [
        {
          paymentType: PaymentType.COD,
          status: AppointmentPackageStatus.PENDING_PAYMENT,
        },
      ],
    });

    const result = await AppointmentsService.prototype.staffCancelAppointment.call(
      serviceContext,
      'appointment-1',
      {},
    );

    expect(result.status).toBe(AppointmentStatus.CANCELLED);
    expect(
      serviceContext.socketGatewayService.broadcastAppointmentStatusChange,
    ).toHaveBeenCalled();
  });

  it('UT-25-03: Reject missing or invalid JWT.', () => {
    const patientGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.patientCancelAppointment,
    );
    const staffGuards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.staffCancelAppointment,
    );

    expect(patientGuards).toHaveLength(2);
    expect(staffGuards).toHaveLength(2);
  });

  it('UT-25-04: Reject endpoint role mismatch.', () => {
    const patientRoles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.patientCancelAppointment,
    );
    const staffRoles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.staffCancelAppointment,
    );

    expect(patientRoles).toEqual([AccountRole.PATIENT]);
    expect(staffRoles).toEqual([AccountRole.CLINIC_STAFF]);
  });

  it("UT-25-05: Reject patient cancelling another patient's appointment.", async () => {
    const serviceContext = createServiceContext({
      appointment: createAppointment({ patientId: 'patient-2' }),
    });

    await expect(
      AppointmentsService.prototype.patientCancelAppointment.call(
        serviceContext,
        'appointment-1',
        'patient-1',
        {},
      ),
    ).rejects.toThrow(
      new ForbiddenException('You can only cancel your own appointments'),
    );
  });

  it('UT-25-06: Reject missing appointment.', async () => {
    const serviceContext = createServiceContext({ appointment: null });

    await expect(
      AppointmentsService.prototype.staffCancelAppointment.call(
        serviceContext,
        'missing-appointment',
        {},
      ),
    ).rejects.toThrow(new NotFoundException('Appointment not found'));
  });

  it('UT-25-07: Reject online-paid appointment cancellation.', async () => {
    const serviceContext = createServiceContext({
      packages: [
        {
          paymentType: PaymentType.ONLINE,
          status: AppointmentPackageStatus.PAID,
        },
      ],
    });

    await expect(
      AppointmentsService.prototype.staffCancelAppointment.call(
        serviceContext,
        'appointment-1',
        {},
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot cancel an appointment that has been paid online',
      ),
    );
  });

  it('UT-25-08: Reject non-cancellable status.', async () => {
    const serviceContext = createServiceContext({
      appointment: createAppointment({ status: AppointmentStatus.CANCELLED }),
    });

    await expect(
      AppointmentsService.prototype.staffCancelAppointment.call(
        serviceContext,
        'appointment-1',
        {},
      ),
    ).rejects.toThrow(
      new BadRequestException('Cannot cancel appointment with status "CANCELLED"'),
    );
  });

  it('UT-25-09: Reject invalid patientNote DTO input.', async () => {
    const invalidLengthErrors = await validate(
      plainToInstance(StaffCancelAppointmentDto, { patientNote: 'A'.repeat(1001) }),
    );

    const messages = invalidLengthErrors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );

    expect(() =>
      plainToInstance(PatientCancelAppointmentDto, { patientNote: 123 }),
    ).toThrow('trim is not a function');
    expect(messages).toContain('Patient note must not exceed 1000 characters');
  });

  it('UT-25-10: Accept cancellation without patientNote.', async () => {
    const serviceContext = createServiceContext({
      packages: [
        {
          paymentType: PaymentType.COD,
          status: AppointmentPackageStatus.PENDING_PAYMENT,
        },
      ],
    });

    const result = await AppointmentsService.prototype.patientCancelAppointment.call(
      serviceContext,
      'appointment-1',
      'patient-1',
      {},
    );

    expect(result.status).toBe(AppointmentStatus.CANCELLED);
    expect(result.patientNote).toBeNull();
  });
});
