import { ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { ErmsController } from '../../../../src/modules/prescriptions/erms.controller';
import { ErmsService } from '../../../../src/modules/prescriptions/erms.service';
import { ERMRecordType } from '../../../../src/modules/prescriptions/enums/erm-enums';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-68 View Medical Record Detail', () => {
  const createPatientServiceContext = ({ appointment = { _id: 'appt-1' }, erm }: any = {}) => ({
    dataSource: {
      getRepository: jest
        .fn()
        .mockReturnValueOnce({
          findOne: jest.fn().mockResolvedValue(appointment),
        })
        .mockReturnValueOnce({
          createQueryBuilder: jest.fn().mockReturnValue({
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn().mockResolvedValue(erm),
          }),
        }),
    },
  }) as any;

  const createDoctorServiceContext = ({
    erm,
    consultation,
    xray,
    doctorId = 'doctor-1',
  }: any = {}) => ({
    ermRepository: {
      findErmWithAppointment: jest.fn().mockResolvedValue(erm),
      findConsultationByErmId: jest.fn().mockResolvedValue(consultation),
      findXrayByErmId: jest.fn().mockResolvedValue(xray),
      findUltrasoundByErmId: jest.fn().mockResolvedValue(null),
      findLabByErmId: jest.fn().mockResolvedValue(null),
      findProcedureByErmId: jest.fn().mockResolvedValue(null),
      findBoneDensityByErmId: jest.fn().mockResolvedValue(null),
    },
    dataSource: {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({
            clinicService: { service: { serviceName: 'Service Name' } },
          }),
        }),
      }),
      query: jest.fn().mockResolvedValue([{ creator_name: 'Doctor A' }]),
    },
    doctorId,
  }) as any;

  const baseErm = {
    _id: 'erm-1',
    serviceAppointmentsId: 'sa-1',
    appointmentId: 'appt-1',
    recordType: ERMRecordType.CONSULTATION,
    serviceCode: 'SV1',
    status: 'IN_PROGRESS',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
    createdBy: 'doctor-1',
    appointment: { doctorId: 'doctor-1' },
  } as any;

  it('UT-68-01: Patient gets own ERM detail', async () => {
    const controllerContext = {
      appointmentsService: {
        getPatientERMDetail: jest.fn().mockResolvedValue({ _id: 'erm-1' }),
      },
    } as any;

    const result = await AppointmentsController.prototype.getPatientERMDetail.call(
      controllerContext,
      'appt-1',
      'erm-1',
      { user: { _id: 'patient-1' } },
    );

    expect(controllerContext.appointmentsService.getPatientERMDetail).toHaveBeenCalledWith('patient-1', 'appt-1', 'erm-1');
    expect(result).toEqual({ _id: 'erm-1' });
  });

  it('UT-68-02: Doctor gets assigned ERM detail', async () => {
    const controllerContext = {
      ermsService: {
        getDoctorERMDetail: jest.fn().mockResolvedValue({ erm_id: 'erm-1' }),
      },
    } as any;

    const result = await ErmsController.prototype.getDoctorERMDetail.call(
      controllerContext,
      { user: { _id: 'doctor-1' } },
      'erm-1',
      {},
    );

    expect(controllerContext.ermsService.getDoctorERMDetail).toHaveBeenCalledWith('erm-1', 'doctor-1');
    expect(result).toEqual({ erm_id: 'erm-1' });
  });

  it('UT-68-03: Doctor consultation mapping success', async () => {
    const serviceContext = createDoctorServiceContext({
      erm: baseErm,
      consultation: { visitType: 'FIRST_VISIT', mainServiceCode: 'MS1' },
    });

    const result = await ErmsService.prototype.getDoctorERMDetail.call(serviceContext, 'erm-1', 'doctor-1');

    expect(result.consultation_data).toMatchObject({ visit_type: 'FIRST_VISIT', main_service_code: 'MS1' });
  });

  it('UT-68-04: Doctor non-consultation mapping success', async () => {
    const serviceContext = createDoctorServiceContext({
      erm: { ...baseErm, recordType: ERMRecordType.XRAY },
      xray: { region: 'Chest', indication: 'Pain' },
    });

    const result = await ErmsService.prototype.getDoctorERMDetail.call(serviceContext, 'erm-1', 'doctor-1');

    expect(result.xray_data).toMatchObject({ region: 'Chest', indication: 'Pain' });
  });

  it('UT-68-05: Missing JWT rejected', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AppointmentsController.prototype.getPatientERMDetail);

    expect(guards).toHaveLength(2);
  });

  it('UT-68-06: Non-patient blocked on patient endpoint', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AppointmentsController.prototype.getPatientERMDetail);

    expect(roles).toEqual([AccountRole.PATIENT]);
  });

  it('UT-68-07: Patient appointment ownership fails', async () => {
    const serviceContext = createPatientServiceContext({ appointment: null, erm: null });

    await expect(
      AppointmentsService.prototype.getPatientERMDetail.call(serviceContext, 'patient-1', 'appt-1', 'erm-1'),
    ).rejects.toThrow(/Appointment not found/);
  });

  it('UT-68-08: Patient ERM not found by appointment scope', async () => {
    const serviceContext = createPatientServiceContext({ appointment: { _id: 'appt-1' }, erm: null });

    await expect(
      AppointmentsService.prototype.getPatientERMDetail.call(serviceContext, 'patient-1', 'appt-1', 'erm-x'),
    ).rejects.toThrow('ERM record not found');
  });

  it('UT-68-09: Doctor forbidden when ERM not in doctor scope', async () => {
    const serviceContext = createDoctorServiceContext({
      erm: { ...baseErm, appointment: { doctorId: 'other-doctor' } },
    });

    await expect(
      ErmsService.prototype.getDoctorERMDetail.call(serviceContext, 'erm-1', 'doctor-1'),
    ).rejects.toThrow('You do not have access to this ERM');
  });

  it('UT-68-10: Doctor ERM id not found', async () => {
    const serviceContext = createDoctorServiceContext({ erm: null });

    await expect(
      ErmsService.prototype.getDoctorERMDetail.call(serviceContext, 'erm-x', 'doctor-1'),
    ).rejects.toThrow('ERM not found');
  });

  it('UT-68-11: Invalid UUID format on patient path', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-68-12: Patient detail with absent child groups', async () => {
    const serviceContext = createPatientServiceContext({
      appointment: { _id: 'appt-1' },
      erm: {
        _id: 'erm-1',
        appointmentId: 'appt-1',
        recordType: ERMRecordType.CONSULTATION,
        status: 'DRAFT',
        serviceCode: 'SV1',
        createdAt: '2026-01-01',
        signedAt: null,
        consultations: undefined,
        xrays: undefined,
        labs: undefined,
        ultrasounds: undefined,
        boneDensities: undefined,
        procedures: undefined,
      },
    });

    const result = await AppointmentsService.prototype.getPatientERMDetail.call(serviceContext, 'patient-1', 'appt-1', 'erm-1');

    expect(result.details).toEqual({
      consultations: [],
      xrays: [],
      labs: [],
      ultrasounds: [],
      bone_densities: [],
      procedures: [],
    });
  });

  it('UT-68-13: Doctor detail with null detail block when child missing', async () => {
    const serviceContext = createDoctorServiceContext({ erm: baseErm, consultation: null });

    const result = await ErmsService.prototype.getDoctorERMDetail.call(serviceContext, 'erm-1', 'doctor-1');

    expect(result.consultation_data).toBeNull();
    expect(result.erm_id).toBe('erm-1');
  });
});
