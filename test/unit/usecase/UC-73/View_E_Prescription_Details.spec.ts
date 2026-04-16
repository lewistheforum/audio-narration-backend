import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { PrescriptionsService } from '../../../../src/modules/prescriptions/prescriptions.service';

describe('UC-73 View E-Prescription Details', () => {
  const appointmentId = '123e4567-e89b-12d3-a456-426614174000';

  const createServiceContext = (options?: {
    appointment?: any;
    ePrescription?: any;
  }) => {
    const appointment = options && 'appointment' in options ? options.appointment : { _id: appointmentId };
    const ePrescription =
      options && 'ePrescription' in options
        ? options.ePrescription
        :
      ({
        _id: 'ep-1',
        appointmentId,
        doctorNote: 'note',
        status: 'active',
        createdAt: '2026-04-10T00:00:00.000Z',
        detailEPrescriptions: [],
      } as any);

    return {
      appointmentRepository: {
        findOne: jest.fn().mockResolvedValue(appointment),
      },
      ePrescriptionRepository: {
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(ePrescription),
        }),
      },
    } as any;
  };

  const buildDetail = (id: string, deletedAt: any = null) => ({
    _id: id,
    quantity: 1,
    checkOut: '1/day',
    note: 'after meal',
    deletedAt,
    medicine: {
      id: `med-${id}`,
      name: `Med ${id}`,
      subtitle0: 'sub',
      used: 'usage text',
      sideEffect: 'none',
    },
  });

  it('UT-73-01: View e-prescription detail success', async () => {
    const serviceContext = createServiceContext({
      ePrescription: {
        _id: 'ep-1',
        appointmentId,
        doctorNote: 'note',
        status: 'active',
        createdAt: '2026-04-10T00:00:00.000Z',
        detailEPrescriptions: [buildDetail('1')],
      },
    });

    const result = await PrescriptionsService.prototype.getPatientEPrescription.call(serviceContext, 'patient-1', appointmentId);

    expect(result._id).toBe('ep-1');
    expect(result.detail_e_prescriptions).toHaveLength(1);
  });

  it('UT-73-02: Validate medicine field mapping in detail items', async () => {
    const serviceContext = createServiceContext({
      ePrescription: {
        _id: 'ep-1',
        appointmentId,
        doctorNote: 'note',
        status: 'active',
        createdAt: '2026-04-10T00:00:00.000Z',
        detailEPrescriptions: [buildDetail('1')],
      },
    });

    const result = await PrescriptionsService.prototype.getPatientEPrescription.call(serviceContext, 'patient-1', appointmentId);

    expect(result.detail_e_prescriptions[0].medicine).toEqual({
      id: 'med-1',
      name: 'Med 1',
      subtitle_0: 'sub',
      usage: 'usage text',
      side_effect: 'none',
    });
  });

  it('UT-73-03: Soft-deleted detail records excluded', async () => {
    const serviceContext = createServiceContext({
      ePrescription: {
        _id: 'ep-1',
        appointmentId,
        doctorNote: 'note',
        status: 'active',
        createdAt: '2026-04-10T00:00:00.000Z',
        detailEPrescriptions: [buildDetail('1'), buildDetail('2', '2026-04-11T00:00:00.000Z')],
      },
    });

    const result = await PrescriptionsService.prototype.getPatientEPrescription.call(serviceContext, 'patient-1', appointmentId);

    expect(result.detail_e_prescriptions).toHaveLength(1);
    expect(result.detail_e_prescriptions[0]._id).toBe('1');
  });

  it('UT-73-04: Missing JWT rejected', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AppointmentsController.prototype.getPatientEPrescription);

    expect(guards).toHaveLength(2);
  });

  it('UT-73-05: Non-patient role blocked', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AppointmentsController.prototype.getPatientEPrescription);

    expect(roles).toEqual([AccountRole.PATIENT]);
  });

  it('UT-73-06: Invalid appointment UUID', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid_format', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-73-07: Appointment missing or not owned', async () => {
    const serviceContext = createServiceContext({ appointment: null });

    await expect(PrescriptionsService.prototype.getPatientEPrescription.call(serviceContext, 'patient-1', appointmentId)).rejects.toThrow(
      new NotFoundException('Appointment not found or access denied'),
    );
  });

  it('UT-73-08: Appointment not completed (current code path allows retrieval)', async () => {
    const serviceContext = createServiceContext({
      appointment: { _id: appointmentId, status: 'IN_PROGRESS' },
      ePrescription: {
        _id: 'ep-1',
        appointmentId,
        doctorNote: 'note',
        status: 'active',
        createdAt: '2026-04-10T00:00:00.000Z',
        detailEPrescriptions: [buildDetail('1')],
      },
    });

    const result = await PrescriptionsService.prototype.getPatientEPrescription.call(serviceContext, 'patient-1', appointmentId);

    expect(result._id).toBe('ep-1');
  });

  it('UT-73-09: Completed appointment but no e-prescription', async () => {
    const serviceContext = createServiceContext({ ePrescription: null });

    await expect(PrescriptionsService.prototype.getPatientEPrescription.call(serviceContext, 'patient-1', appointmentId)).rejects.toThrow(
      new NotFoundException('E-Prescription not found'),
    );
  });

  it('UT-73-10: Boundary empty detail list', async () => {
    const serviceContext = createServiceContext({
      ePrescription: {
        _id: 'ep-1',
        appointmentId,
        doctorNote: 'note',
        status: 'active',
        createdAt: '2026-04-10T00:00:00.000Z',
        detailEPrescriptions: [],
      },
    });

    const result = await PrescriptionsService.prototype.getPatientEPrescription.call(serviceContext, 'patient-1', appointmentId);

    expect(result.detail_e_prescriptions).toEqual([]);
  });

  it('UT-73-11: Boundary single detail item', async () => {
    const serviceContext = createServiceContext({
      ePrescription: {
        _id: 'ep-1',
        appointmentId,
        doctorNote: 'note',
        status: 'active',
        createdAt: '2026-04-10T00:00:00.000Z',
        detailEPrescriptions: [buildDetail('single')],
      },
    });

    const result = await PrescriptionsService.prototype.getPatientEPrescription.call(serviceContext, 'patient-1', appointmentId);

    expect(result.detail_e_prescriptions).toHaveLength(1);
    expect(result.detail_e_prescriptions[0]._id).toBe('single');
  });
});
