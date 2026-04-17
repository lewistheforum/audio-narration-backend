import { ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AppointmentsController } from '../../../../src/modules/appointments/appointments.controller';
import { AppointmentsService } from '../../../../src/modules/appointments/appointments.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-67 View Medical Record List', () => {
  const createServiceContext = ({ appointment = { _id: 'appt-1' }, ermsRaw = [] }: any = {}) => ({
    dataSource: {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(appointment),
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(ermsRaw),
      }),
    },
  }) as any;

  it('UT-67-01: View owned appointment ERM list', async () => {
    const controllerContext = {
      appointmentsService: {
        getPatientERMsList: jest.fn().mockResolvedValue([{ id: 'erm-1' }]),
      },
    } as any;

    const result = await AppointmentsController.prototype.getPatientERMsList.call(
      controllerContext,
      'appt-1',
      { user: { _id: 'patient-1' } },
    );

    expect(controllerContext.appointmentsService.getPatientERMsList).toHaveBeenCalledWith('patient-1', 'appt-1');
    expect(result).toEqual([{ id: 'erm-1' }]);
  });

  it('UT-67-02: List includes consultation/xray/lab special ERM items', async () => {
    const serviceContext = createServiceContext({
      ermsRaw: [
        {
          id: 'erm-1',
          record_type: 'CONSULTATION',
          status: 'DRAFT',
          service_code: 'SV1',
          created_at: '2026-01-01',
          ec_id: 'ec-1',
          ec_service_code: 'CONS',
          ex_id: 'ex-1',
          ex_region: 'Chest',
          el_id: 'el-1',
          el_panel_name: 'CBC',
        },
      ],
    });

    const result = await AppointmentsService.prototype.getPatientERMsList.call(serviceContext, 'patient-1', 'appt-1');

    expect(result[0].special_erms.map((x) => x.type)).toEqual(expect.arrayContaining(['CONSULTATION', 'XRAY', 'LAB']));
  });

  it('UT-67-03: Empty list when no ERM rows', async () => {
    const serviceContext = createServiceContext({ ermsRaw: [] });

    const result = await AppointmentsService.prototype.getPatientERMsList.call(serviceContext, 'patient-1', 'appt-1');

    expect(result).toEqual([]);
  });

  it('UT-67-04: Deduplicate same special ERM id', async () => {
    const serviceContext = createServiceContext({
      ermsRaw: [
        {
          id: 'erm-1',
          record_type: 'CONSULTATION',
          status: 'DRAFT',
          service_code: 'SV1',
          created_at: '2026-01-01',
          ec_id: 'ec-1',
          ec_service_code: 'CONS',
        },
        {
          id: 'erm-1',
          record_type: 'CONSULTATION',
          status: 'DRAFT',
          service_code: 'SV1',
          created_at: '2026-01-01',
          ec_id: 'ec-1',
          ec_service_code: 'CONS',
        },
      ],
    });

    const result = await AppointmentsService.prototype.getPatientERMsList.call(serviceContext, 'patient-1', 'appt-1');

    expect(result[0].special_erms).toHaveLength(1);
  });

  it('UT-67-05: Missing JWT rejected', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AppointmentsController.prototype.getPatientERMsList);

    expect(guards).toHaveLength(2);
  });

  it('UT-67-06: Non-patient role rejected', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AppointmentsController.prototype.getPatientERMsList);

    expect(roles).toEqual([AccountRole.PATIENT]);
  });

  it('UT-67-07: Appointment not found or access denied', async () => {
    const serviceContext = createServiceContext({ appointment: null });

    await expect(
      AppointmentsService.prototype.getPatientERMsList.call(serviceContext, 'patient-1', 'appt-404'),
    ).rejects.toThrow(/Appointment not found/);
  });

  it('UT-67-08: Invalid appointment UUID format', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-67-09: ERM rows without child records', async () => {
    const serviceContext = createServiceContext({
      ermsRaw: [
        {
          id: 'erm-1',
          record_type: 'CONSULTATION',
          status: 'DRAFT',
          service_code: 'SV1',
          created_at: '2026-01-01',
          ec_id: null,
          ex_id: null,
          el_id: null,
          eu_id: null,
          erd_id: null,
          ebd_id: null,
        },
      ],
    });

    const result = await AppointmentsService.prototype.getPatientERMsList.call(serviceContext, 'patient-1', 'appt-1');

    expect(result[0].special_erms).toEqual([]);
  });

  it('UT-67-10: Large ERM list boundary', async () => {
    const ermsRaw = Array.from({ length: 100 }, (_, i) => ({
      id: `erm-${i}`,
      record_type: 'CONSULTATION',
      status: 'DRAFT',
      service_code: `SV${i}`,
      created_at: '2026-01-01',
      ec_id: null,
    }));
    const serviceContext = createServiceContext({ ermsRaw });

    const result = await AppointmentsService.prototype.getPatientERMsList.call(serviceContext, 'patient-1', 'appt-1');

    expect(result).toHaveLength(100);
  });
});
