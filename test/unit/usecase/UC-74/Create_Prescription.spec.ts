import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { CreatePrescriptionDto } from '../../../../src/modules/prescriptions/dto/create-prescription.dto';
import { ErmsController } from '../../../../src/modules/prescriptions/erms.controller';
import { PrescriptionsService } from '../../../../src/modules/prescriptions/prescriptions.service';

describe('UC-74 Create Prescription', () => {
  const appointmentId = '123e4567-e89b-12d3-a456-426614174000';
  const doctorId = 'doctor-1';

  const dto: CreatePrescriptionDto = {
    doctorNote: 'note',
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
    transactionThrows?: boolean;
  }) => {
    const appointment = options && 'appointment' in options ? options.appointment : { _id: appointmentId, doctorId, status: 'CHECKED_IN' };
    const validMedicines = options?.validMedicines ?? [{ id: dto.medicines[0].medicineId, name: 'M1', habitForming: false }];
    const existingPrescription = options && 'existingPrescription' in options ? options.existingPrescription : null;

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
      save: jest.fn().mockImplementation(async (entity: any, payload: any) => {
        if (entity?.name === 'EPrescription') return { _id: 'ep-new', ...payload };
        return payload;
      }),
    } as any;

    return {
      dataSource: {
        getRepository: jest.fn().mockImplementation((entity: any) => {
          if (entity?.name === 'Appointment') return appointmentRepo;
          if (entity?.name === 'Medicine') return medicineRepo;
          return ePrescriptionRepo;
        }),
        transaction: jest.fn().mockImplementation(async (callback: any) => {
          if (options?.transactionThrows) throw new Error('db failed');
          return callback(manager);
        }),
      },
      generateReferenceId: jest.fn().mockResolvedValue('EP202604100001'),
      getPrescription: jest.fn().mockResolvedValue({ _id: 'ep-result' }),
    } as any;
  };

  it('UT-74-01: Create prescription success in CHECKED_IN status', async () => {
    const serviceContext = createServiceContext({ appointment: { _id: appointmentId, doctorId, status: 'CHECKED_IN' } });

    const result = await PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId);

    expect(result).toEqual({ _id: 'ep-result' });
  });

  it('UT-74-02: Create prescription success in IN_PROGRESS status', async () => {
    const serviceContext = createServiceContext({
      appointment: { _id: appointmentId, doctorId, status: 'IN_PROGRESS' },
      validMedicines: [
        { id: dto.medicines[0].medicineId, name: 'M1', habitForming: false },
        { id: '123e4567-e89b-42d3-a456-426614174002', name: 'M2', habitForming: false },
      ],
    });

    const payload = {
      doctorNote: 'note',
      medicines: [
        dto.medicines[0],
        { medicineId: '123e4567-e89b-42d3-a456-426614174002', quantity: 2, note: 'note2', checkOut: '2/day' },
      ],
    };

    const result = await PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, payload as any, doctorId);

    expect(result).toEqual({ _id: 'ep-result' });
  });

  it('UT-74-03: Create success with doctorNote omitted', async () => {
    const serviceContext = createServiceContext({ appointment: { _id: appointmentId, doctorId, status: 'IN_PROGRESS' } });

    const result = await PrescriptionsService.prototype.createOrUpdatePrescription.call(
      serviceContext,
      appointmentId,
      { medicines: dto.medicines } as any,
      doctorId,
    );

    expect(result).toEqual({ _id: 'ep-result' });
  });

  it('UT-74-04: Create success with habit-forming medicine', async () => {
    const serviceContext = createServiceContext({
      appointment: { _id: appointmentId, doctorId, status: 'IN_PROGRESS' },
      validMedicines: [{ id: dto.medicines[0].medicineId, name: 'M1', habitForming: true }],
    });

    const result = await PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId);

    expect(result).toEqual({ _id: 'ep-result' });
  });

  it('UT-74-05: Reject missing JWT', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ErmsController.prototype.createOrUpdatePrescription);

    expect(guards).toHaveLength(2);
  });

  it('UT-74-06: Reject non-doctor role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ErmsController.prototype.createOrUpdatePrescription);

    expect(roles).toEqual([AccountRole.DOCTOR]);
  });

  it('UT-74-07: Reject non-existing appointment', async () => {
    const serviceContext = createServiceContext({ appointment: null });

    await expect(PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId)).rejects.toThrow(
      new NotFoundException('Appointment not found'),
    );
  });

  it('UT-74-08: Reject appointment not assigned to doctor', async () => {
    const serviceContext = createServiceContext({ appointment: { _id: appointmentId, doctorId: 'doctor-2', status: 'IN_PROGRESS' } });

    await expect(PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId)).rejects.toThrow(
      new BadRequestException('You do not have permission to create prescription for this appointment'),
    );
  });

  it('UT-74-09: Reject disallowed appointment status', async () => {
    const serviceContext = createServiceContext({ appointment: { _id: appointmentId, doctorId, status: 'COMPLETED' } });

    await expect(PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId)).rejects.toThrow(
      new BadRequestException('Can only create/update prescription when appointment is IN_PROGRESS or CHECKED_IN'),
    );
  });

  it('UT-74-10: Reject missing medicine IDs in inventory', async () => {
    const serviceContext = createServiceContext({
      appointment: { _id: appointmentId, doctorId, status: 'IN_PROGRESS' },
      validMedicines: [],
    });

    await expect(PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId)).rejects.toThrow(
      'Medicines not found or deleted',
    );
  });

  it('UT-74-11: Reject invalid DTO body', async () => {
    const messages = await collectMessages({ doctorNote: 123, medicines: 'invalid' });

    expect(messages.length).toBeGreaterThan(0);
  });

  it('UT-74-12: Handle runtime transaction error', async () => {
    const serviceContext = createServiceContext({
      appointment: { _id: appointmentId, doctorId, status: 'IN_PROGRESS' },
      transactionThrows: true,
    });

    await expect(PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId)).rejects.toThrow(
      'db failed',
    );
  });

  it('UT-74-13: Boundary medicines min size equals 1', async () => {
    const messages = await collectMessages({
      doctorNote: 'note',
      medicines: [dto.medicines[0]],
    });

    expect(messages).toEqual([]);
  });

  it('UT-74-14: Boundary quantity equals 1', async () => {
    const serviceContext = createServiceContext({ appointment: { _id: appointmentId, doctorId, status: 'CHECKED_IN' } });

    const result = await PrescriptionsService.prototype.createOrUpdatePrescription.call(serviceContext, appointmentId, dto, doctorId);

    expect(result).toEqual({ _id: 'ep-result' });
  });
});
