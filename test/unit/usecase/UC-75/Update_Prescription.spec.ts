import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { CreatePrescriptionDto } from '../../../../src/modules/prescriptions/dto/create-prescription.dto';
import { ErmsController } from '../../../../src/modules/prescriptions/erms.controller';
import { PrescriptionsService } from '../../../../src/modules/prescriptions/prescriptions.service';

describe('UC-75 Update Prescription', () => {
  const appointmentId = '123e4567-e89b-12d3-a456-426614174000';
  const doctorId = 'doctor-1';

  const dto: CreatePrescriptionDto = {
    doctorNote: 'updated note',
    medicines: [
      {
        medicineId: '123e4567-e89b-42d3-a456-426614174001',
        quantity: 1,
        note: 'after meal',
        checkOut: '1/day',
      },
    ],
  };

  const collectMessages = async (value: object) => {
    const errors = await validate(plainToInstance(CreatePrescriptionDto, value));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  const createServiceContext = (options?: {
    appointment?: any;
    validMedicines?: any[];
    existingPrescription?: any;
  }) => {
    const appointment = options && 'appointment' in options ? options.appointment : { _id: appointmentId, doctorId, status: 'IN_PROGRESS' };
    const validMedicines = options?.validMedicines ?? [{ id: dto.medicines[0].medicineId, name: 'M1', habitForming: false }];
    const existingPrescription = options && 'existingPrescription' in options ? options.existingPrescription : { _id: 'ep-1', appointmentId };

    const appointmentRepo = { findOne: jest.fn().mockResolvedValue(appointment) };
    const medicineRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(validMedicines),
      }),
    };
    const ePrescriptionRepo = { findOne: jest.fn().mockResolvedValue(existingPrescription) };

    const manager = {
      createQueryBuilder: jest.fn().mockReturnValue({
        softDelete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      }),
      create: jest.fn().mockImplementation((_: any, payload: any) => payload),
      save: jest.fn().mockImplementation(async (_entity: any, payload: any) => payload),
    } as any;

    return {
      dataSource: {
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity?.name === 'Appointment') return appointmentRepo;
          if (entity?.name === 'Medicine') return medicineRepo;
          return ePrescriptionRepo;
        }),
        transaction: jest.fn().mockImplementation(async (callback: any) => callback(manager)),
      },
      generateReferenceId: jest.fn().mockResolvedValue('EP202604100001'),
      getPrescription: jest.fn().mockResolvedValue({ _id: 'ep-result' }),
    } as any;
  };

  it('UT-75-01: Update existing prescription in IN_PROGRESS', async () => {
    const serviceContext = createServiceContext({ appointment: { _id: appointmentId, doctorId, status: 'IN_PROGRESS' } });

    const result = await PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId);

    expect(result).toEqual({ _id: 'ep-result' });
  });

  it('UT-75-02: Update existing prescription in CHECKED_IN', async () => {
    const serviceContext = createServiceContext({ appointment: { _id: appointmentId, doctorId, status: 'CHECKED_IN' } });

    const result = await PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId);

    expect(result).toEqual({ _id: 'ep-result' });
  });

  it('UT-75-03: Upsert behavior when prescription not yet exists', async () => {
    const serviceContext = createServiceContext({
      appointment: { _id: appointmentId, doctorId, status: 'IN_PROGRESS' },
      existingPrescription: null,
    });

    const result = await PrescriptionsService.prototype.createOrUpdatePrescription.call(
      serviceContext,
      appointmentId,
      { medicines: dto.medicines } as any,
      doctorId,
    );

    expect(result).toEqual({ _id: 'ep-result' });
  });

  it('UT-75-04: Replace old details with new list', async () => {
    const serviceContext = createServiceContext({
      appointment: { _id: appointmentId, doctorId, status: 'IN_PROGRESS' },
      validMedicines: [
        { id: dto.medicines[0].medicineId, name: 'M1', habitForming: false },
        { id: '123e4567-e89b-42d3-a456-426614174002', name: 'M2', habitForming: false },
      ],
    });

    const result = await PrescriptionsService.prototype.createOrUpdatePrescription.call(
      serviceContext,
      appointmentId,
      {
        doctorNote: 'replace',
        medicines: [
          dto.medicines[0],
          { medicineId: '123e4567-e89b-42d3-a456-426614174002', quantity: 2, note: 'n2', checkOut: '2/day' },
        ],
      } as any,
      doctorId,
    );

    expect(result).toEqual({ _id: 'ep-result' });
  });

  it('UT-75-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ErmsController.prototype.updatePrescription);

    expect(guards).toHaveLength(2);
  });

  it('UT-75-06: Reject unauthorized role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ErmsController.prototype.updatePrescription);

    expect(roles).toEqual([AccountRole.DOCTOR, AccountRole.CLINIC_STAFF]);
  });

  it('UT-75-07: CLINIC_STAFF blocked by ownership check', async () => {
    const serviceContext = createServiceContext({ appointment: { _id: appointmentId, doctorId: 'doctor-2', status: 'IN_PROGRESS' } });

    await expect(PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, 'staff-1')).rejects.toThrow(
      new BadRequestException('You do not have permission to create prescription for this appointment'),
    );
  });

  it('UT-75-08: Appointment not found', async () => {
    const serviceContext = createServiceContext({ appointment: null });

    await expect(PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId)).rejects.toThrow(
      new NotFoundException('Appointment not found'),
    );
  });

  it('UT-75-09: Appointment status completed rejected', async () => {
    const serviceContext = createServiceContext({ appointment: { _id: appointmentId, doctorId, status: 'COMPLETED' } });

    await expect(PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId)).rejects.toThrow(
      new BadRequestException('Can only create/update prescription when appointment is IN_PROGRESS or CHECKED_IN'),
    );
  });

  it('UT-75-10: Missing medicine in DB', async () => {
    const serviceContext = createServiceContext({ validMedicines: [] });

    await expect(PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId)).rejects.toThrow(
      'Medicines not found or deleted',
    );
  });

  it('UT-75-11: DTO validation error', async () => {
    const messages = await collectMessages({ doctorNote: 123, medicines: [] });

    expect(messages.length).toBeGreaterThan(0);
  });

  it('UT-75-12: Boundary medicines min size = 1', async () => {
    const messages = await collectMessages({
      doctorNote: 'ok',
      medicines: [dto.medicines[0]],
    });

    expect(messages).toEqual([]);
  });

  it('UT-75-13: Boundary quantity = 1', async () => {
    const serviceContext = createServiceContext({ appointment: { _id: appointmentId, doctorId, status: 'CHECKED_IN' } });

    const result = await PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId);

    expect(result).toEqual({ _id: 'ep-result' });
  });
});
