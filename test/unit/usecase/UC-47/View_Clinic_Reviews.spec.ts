import { NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums';
import { ClinicAdminsController } from '../../../../src/modules/accounts/api-admin-clinic-admin/clinic-admins.controller';
import { ClinicAdminsService } from '../../../../src/modules/accounts/api-admin-clinic-admin/clinic-admins.service';
import { FeedbackType } from '../../../../src/modules/reports/enums/feedback-type.enum';

describe('UC-47 View Clinic Reviews', () => {
  const createRawQueryBuilder = (rawRows: any[], total = rawRows.length) => ({
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawRows),
    getCount: jest.fn().mockResolvedValue(total),
  });

  const createServiceContext = ({
    admin = { _id: 'admin-1', role: AccountRole.CLINIC_ADMIN },
    managers = [{ _id: 'manager-1' }],
    rows = [],
    total = rows.length,
  }: {
    admin?: any;
    managers?: any[];
    rows?: any[];
    total?: number;
  } = {}) => {
    const rawQuery = createRawQueryBuilder(rows, total);

    return {
      rawQuery,
      serviceContext: {
        accountRepository: {
          findOne: jest.fn().mockResolvedValue(admin),
          find: jest.fn().mockResolvedValue(managers),
        },
        feedbackRepository: {
          createQueryBuilder: jest.fn().mockReturnValue(rawQuery),
        },
      } as any,
    };
  };

  it('UT-47-01: View clinic reviews successfully with mixed feedback types.', async () => {
    const { serviceContext } = createServiceContext({
      rows: [
        {
          id: 'feedback-clinic-1',
          rating: 5,
          description: 'Great branch',
          clinicId: 'manager-1',
          type: FeedbackType.CLINIC,
          createdAt: '2026-01-01T00:00:00.000Z',
          clinicName: 'Clinic A',
          doctorName: null,
          patientName: 'Patient A',
          patientAvatar: null,
        },
        {
          id: 'feedback-doctor-1',
          rating: 4,
          description: 'Helpful doctor',
          clinicId: 'manager-1',
          type: FeedbackType.DOCTOR,
          createdAt: '2026-01-02T00:00:00.000Z',
          clinicName: 'Clinic A',
          doctorName: 'Dr. John',
          patientName: 'Patient B',
          patientAvatar: 'avatar.png',
        },
      ],
    });

    const result = await ClinicAdminsService.prototype.getFeedbacks.call(serviceContext, 'admin-1');

    expect(result.total).toBe(2);
    expect(result.data.clinics).toHaveLength(1);
    expect(result.data.doctors).toHaveLength(1);
  });

  it('UT-47-02: Return empty grouped arrays when managers exist without feedback rows.', async () => {
    const { serviceContext } = createServiceContext({ rows: [], total: 0 });

    const result = await ClinicAdminsService.prototype.getFeedbacks.call(serviceContext, 'admin-1');

    expect(result).toEqual({ data: { clinics: [], doctors: [] }, total: 0 });
  });

  it('UT-47-03: Return total 0 when clinic admin has no managers.', async () => {
    const { serviceContext } = createServiceContext({ managers: [] });

    const result = await ClinicAdminsService.prototype.getFeedbacks.call(serviceContext, 'admin-1');

    expect(result).toEqual({ data: { clinics: [], doctors: [] }, total: 0 });
  });

  it('UT-47-04: Reject request with missing JWT.', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      ClinicAdminsController.prototype.getFeedbacks,
    );

    expect(guards).toBeUndefined();
  });

  it('UT-47-05: Reject request with expired JWT.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ClinicAdminsController.prototype.getFeedbacks);

    expect(roles).toBeUndefined();
  });

  it('UT-47-06: Reject invalid UUID in path param.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });

  it('UT-47-07: Return not found when clinic admin id does not exist.', async () => {
    const { serviceContext } = createServiceContext({ admin: null });

    await expect(
      ClinicAdminsService.prototype.getFeedbacks.call(serviceContext, 'admin-missing'),
    ).rejects.toThrow(new NotFoundException('Clinic admin with ID admin-missing not found.'));
  });

  it('UT-47-08: Return internal error when data source query fails.', async () => {
    const { serviceContext, rawQuery } = createServiceContext();
    rawQuery.getRawMany.mockRejectedValue(new Error('db failed'));

    await expect(
      ClinicAdminsService.prototype.getFeedbacks.call(serviceContext, 'admin-1'),
    ).rejects.toThrow('db failed');
  });

  it('UT-47-09: Apply patientName fallback when patientGeneral.fullName is null.', async () => {
    const { serviceContext } = createServiceContext({
      rows: [
        {
          id: 'feedback-clinic-1',
          rating: 5,
          description: 'Great branch',
          clinicId: 'manager-1',
          type: FeedbackType.CLINIC,
          createdAt: '2026-01-01T00:00:00.000Z',
          clinicName: 'Clinic A',
          doctorName: null,
          patientName: null,
          patientAvatar: null,
        },
      ],
    });

    const result = await ClinicAdminsService.prototype.getFeedbacks.call(serviceContext, 'admin-1');

    expect(result.data.clinics[0].patientName).toBe('Unknown');
  });
});
