import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AppointmentPackageStatus } from '../../../../src/modules/appointments/enums/appointment-package-status.enum';
import { AppointmentStatus } from '../../../../src/modules/appointments/enums/appointment-status.enum';
import { PaymentType } from '../../../../src/modules/appointments/enums/payment-type.enum';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-34 Process Counter Payment', () => {
  const createContext = ({
    staffAccount,
    appointment,
    paymentPackage,
    pendingCount = 1,
    updatedPackage,
  }: {
    staffAccount?: any;
    appointment?: any;
    paymentPackage?: any;
    pendingCount?: number;
    updatedPackage?: any;
  }) => ({
    accountRepository: {
      findAccountById: jest.fn().mockResolvedValue(staffAccount),
    },
    appointmentRepository: {
      findOne: jest.fn().mockResolvedValue(appointment),
      save: jest.fn().mockImplementation(async (value) => value),
    },
    appointmentPackageRepository: {
      findByIdForUpdate: jest.fn().mockResolvedValue(paymentPackage),
      updatePackage: jest
        .fn()
        .mockResolvedValue(
          updatedPackage ?? {
            _id: paymentPackage?._id ?? 'package-1',
            amount: paymentPackage?.amount ?? 700000,
            status: AppointmentPackageStatus.PAID,
            paymentType: PaymentType.COD,
            transactionId: null,
            updatedAt: new Date('2099-01-10T12:30:00.000Z'),
          },
        ),
      countPendingPackages: jest.fn().mockResolvedValue(pendingCount),
    },
  } as any);

  const validStaff = {
    _id: 'staff-1',
    role: AccountRole.CLINIC_STAFF,
    parentId: 'clinic-1',
  };

  it('UT-34-01: Confirm one pending cash package successfully.', async () => {
    const serviceContext = createContext({
      staffAccount: validStaff,
      appointment: {
        _id: 'appointment-1',
        clinicId: 'clinic-1',
        status: AppointmentStatus.IN_PROGRESS,
      },
      paymentPackage: {
        _id: 'package-1',
        appointmentId: 'appointment-1',
        amount: 700000,
        status: AppointmentPackageStatus.PENDING_PAYMENT,
      },
      pendingCount: 1,
    });

    const result = await AppointmentsService.prototype.confirmCashPayment.call(
      serviceContext,
      'appointment-1',
      'package-1',
      'staff-1',
    );

    expect(result).toMatchObject({
      message: 'Cash payment confirmed successfully',
      appointmentId: 'appointment-1',
      appointmentStatus: AppointmentStatus.IN_PROGRESS,
      allPackagesPaid: false,
      remainingPendingPackages: 1,
      package: {
        packageId: 'package-1',
        amount: 700000,
        status: AppointmentPackageStatus.PAID,
        paymentType: PaymentType.COD,
        paymentTransactionId: null,
      },
    });
  });

  it('UT-34-02: Confirm last pending package and complete appointment successfully.', async () => {
    const appointment = {
      _id: 'appointment-1',
      clinicId: 'clinic-1',
      status: AppointmentStatus.NEED_FINAL_PAYMENT,
    };
    const serviceContext = createContext({
      staffAccount: validStaff,
      appointment,
      paymentPackage: {
        _id: 'package-1',
        appointmentId: 'appointment-1',
        amount: 900000,
        status: AppointmentPackageStatus.PENDING_PAYMENT,
      },
      pendingCount: 0,
    });

    const result = await AppointmentsService.prototype.confirmCashPayment.call(
      serviceContext,
      'appointment-1',
      'package-1',
      'staff-1',
    );

    expect(result.appointmentStatus).toBe(AppointmentStatus.COMPLETED);
    expect(result.allPackagesPaid).toBe(true);
    expect(appointment.status).toBe(AppointmentStatus.COMPLETED);
    expect(serviceContext.appointmentRepository.save).toHaveBeenCalledWith(appointment);
  });

  it('UT-34-03: Reject missing or invalid JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AppointmentsController.prototype.confirmCashPayment,
    );

    expect(guards).toHaveLength(2);
  });

  it('UT-34-04: Reject authenticated non-staff role.', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      AppointmentsController.prototype.confirmCashPayment,
    );

    expect(roles).toEqual([AccountRole.CLINIC_STAFF]);
  });

  it('UT-34-05: Reject missing staff clinic assignment.', async () => {
    const serviceContext = createContext({
      staffAccount: {
        _id: 'staff-1',
        role: AccountRole.CLINIC_STAFF,
        parentId: null,
      },
    });

    await expect(
      AppointmentsService.prototype.confirmCashPayment.call(
        serviceContext,
        'appointment-1',
        'package-1',
        'staff-1',
      ),
    ).rejects.toThrow(new NotFoundException('Account not found'));
  });

  it('UT-34-06: Reject appointment/package ownership or missing resources.', async () => {
    const missingAppointmentContext = createContext({
      staffAccount: validStaff,
      appointment: null,
    });
    const foreignClinicContext = createContext({
      staffAccount: validStaff,
      appointment: {
        _id: 'appointment-1',
        clinicId: 'clinic-2',
        status: AppointmentStatus.IN_PROGRESS,
      },
    });
    const missingPackageContext = createContext({
      staffAccount: validStaff,
      appointment: {
        _id: 'appointment-1',
        clinicId: 'clinic-1',
        status: AppointmentStatus.IN_PROGRESS,
      },
      paymentPackage: null,
    });
    const wrongAppointmentPackageContext = createContext({
      staffAccount: validStaff,
      appointment: {
        _id: 'appointment-1',
        clinicId: 'clinic-1',
        status: AppointmentStatus.IN_PROGRESS,
      },
      paymentPackage: {
        _id: 'package-1',
        appointmentId: 'appointment-2',
        amount: 700000,
        status: AppointmentPackageStatus.PENDING_PAYMENT,
      },
    });

    await expect(
      AppointmentsService.prototype.confirmCashPayment.call(
        missingAppointmentContext,
        'appointment-1',
        'package-1',
        'staff-1',
      ),
    ).rejects.toThrow(new NotFoundException('Appointment not found'));
    await expect(
      AppointmentsService.prototype.confirmCashPayment.call(
        foreignClinicContext,
        'appointment-1',
        'package-1',
        'staff-1',
      ),
    ).rejects.toThrow(
      new ForbiddenException('You do not have access to this appointment'),
    );
    await expect(
      AppointmentsService.prototype.confirmCashPayment.call(
        missingPackageContext,
        'appointment-1',
        'package-1',
        'staff-1',
      ),
    ).rejects.toThrow(new NotFoundException('Payment package not found'));
    await expect(
      AppointmentsService.prototype.confirmCashPayment.call(
        wrongAppointmentPackageContext,
        'appointment-1',
        'package-1',
        'staff-1',
      ),
    ).rejects.toThrow(
      new BadRequestException('Payment package does not belong to this appointment'),
    );
  });

  it('UT-34-07: Reject already paid package.', async () => {
    const serviceContext = createContext({
      staffAccount: validStaff,
      appointment: {
        _id: 'appointment-1',
        clinicId: 'clinic-1',
        status: AppointmentStatus.IN_PROGRESS,
      },
      paymentPackage: {
        _id: 'package-1',
        appointmentId: 'appointment-1',
        amount: 700000,
        status: AppointmentPackageStatus.PAID,
      },
    });

    await expect(
      AppointmentsService.prototype.confirmCashPayment.call(
        serviceContext,
        'appointment-1',
        'package-1',
        'staff-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot confirm payment: Payment is currently in status "paid"',
      ),
    );
  });

  it('UT-34-08: Reject cancelled package.', async () => {
    const serviceContext = createContext({
      staffAccount: validStaff,
      appointment: {
        _id: 'appointment-1',
        clinicId: 'clinic-1',
        status: AppointmentStatus.IN_PROGRESS,
      },
      paymentPackage: {
        _id: 'package-1',
        appointmentId: 'appointment-1',
        amount: 700000,
        status: AppointmentPackageStatus.CANCELLED,
      },
    });

    await expect(
      AppointmentsService.prototype.confirmCashPayment.call(
        serviceContext,
        'appointment-1',
        'package-1',
        'staff-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'Cannot confirm payment: Payment is currently in status "cancelled"',
      ),
    );
  });

  it('UT-34-09: Reject invalid UUID path params.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_format_id', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
    await expect(pipe.transform('invalid_format_id', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });
});
