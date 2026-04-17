import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { subtractFromVietnamTime } from '../../../../src/common/utils/date.util';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AdminController } from '../../../../src/modules/admin/admin.controller';
import { AdminService } from '../../../../src/modules/admin/admin.service';
import { RegistrationStatus } from '../../../../src/modules/subscriptions/enums/subscription-status.enum';

describe('UC-103 Clean Ghost Data', () => {
  const clinicId = '123e4567-e89b-42d3-a456-426614174100';

  const createCleanupContext = (opts?: {
    subscriptions?: any[];
    missingClinicIds?: string[];
    mailFailClinicIds?: string[];
    deleteFailClinicIds?: string[];
    staleSearchReject?: string;
  }) => {
    const subscriptions = opts?.subscriptions ?? [];
    const missingClinicIds = new Set(opts?.missingClinicIds ?? []);
    const mailFailClinicIds = new Set(opts?.mailFailClinicIds ?? []);
    const deleteFailClinicIds = new Set(opts?.deleteFailClinicIds ?? []);

    const runnerByClinic = new Map<string, any>();

    const context = {
      __currentClinicId: '',
      dataSource: {
        getRepository: jest.fn().mockReturnValue({
          find: opts?.staleSearchReject
            ? jest.fn().mockRejectedValue(new Error(opts.staleSearchReject))
            : jest.fn().mockResolvedValue(subscriptions),
        }),
        createQueryRunner: jest.fn().mockImplementation(() => {
          const queryRunner = {
            __clinicId: context.__currentClinicId,
            connect: jest.fn(),
            startTransaction: jest.fn(),
            commitTransaction: jest.fn(),
            rollbackTransaction: jest.fn(),
            release: jest.fn(),
            manager: {
              find: jest.fn().mockResolvedValue([]),
              createQueryBuilder: jest.fn().mockImplementation(() => ({
                delete: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockImplementation(async () => {
                  if (deleteFailClinicIds.has(queryRunner.__clinicId)) {
                    throw new Error('delete failed');
                  }
                  return { affected: 1 };
                }),
              })),
            },
          } as any;

          runnerByClinic.set(queryRunner.__clinicId, queryRunner);
          return queryRunner;
        }),
      },
      accountRepository: {
        findOne: jest.fn().mockImplementation(async ({ where }: any) => {
          const id = where._id;
          context.__currentClinicId = id;

          if (missingClinicIds.has(id)) {
            return null;
          }

          return {
            _id: id,
            email: `${id}@example.com`,
            username: `clinic-${id}`,
            clinicAdminInformation: { clinicName: `Clinic ${id}` },
          };
        }),
      },
      mailerService: {
        sendStaleRegistrationDeletedEmail: jest
          .fn()
          .mockImplementation(async (email: string) => {
            const id = email.replace('@example.com', '');
            if (mailFailClinicIds.has(id)) {
              throw new Error('mail failed');
            }
          }),
      },
      __runnerByClinic: runnerByClinic,
    } as any;

    return context;
  };

  it('UT-103-01: No stale subscriptions found, return zero summary.', async () => {
    const controller = {
      adminService: {
        cleanupStaleRegistrations: jest.fn().mockResolvedValue({
          totalStaleFound: 0,
          emailsSentSuccessfully: 0,
          emailsFailed: 0,
          deletedSuccessfully: 0,
          deletionsFailed: 0,
          details: [],
        }),
      },
    } as any;

    const result = await AdminController.prototype.cleanupStaleRegistrations.call(controller);

    expect(result.data.totalStaleFound).toBe(0);
    expect(result.data.deletedSuccessfully).toBe(0);
    expect(result.message).toContain('Found 0 stale registrations');
  });

  it('UT-103-02: Stale subscriptions found and fully deleted successfully.', async () => {
    const staleDate = new Date('2020-01-01T00:00:00.000Z');
    const serviceContext = createCleanupContext({
      subscriptions: [{ clinicId, subscriptionStatus: RegistrationStatus.PENDING_APPROVAL, createdAt: staleDate }],
    });

    const result = await AdminService.prototype.cleanupStaleRegistrations.call(serviceContext);

    expect(result.totalStaleFound).toBe(1);
    expect(result.deletedSuccessfully).toBe(1);
    expect(result.deletionsFailed).toBe(0);
  });

  it('UT-103-03: Email sending fails for one stale subscription but deletion still succeeds.', async () => {
    const staleDate = new Date('2020-01-01T00:00:00.000Z');
    const serviceContext = createCleanupContext({
      subscriptions: [{ clinicId, subscriptionStatus: RegistrationStatus.PENDING_LEGAL_SETUP, createdAt: staleDate }],
      mailFailClinicIds: [clinicId],
    });

    const result = await AdminService.prototype.cleanupStaleRegistrations.call(serviceContext);

    expect(result.emailsFailed).toBe(1);
    expect(result.deletedSuccessfully).toBe(1);
    expect(result.details[0].emailSent).toBe(false);
  });

  it('UT-103-04: Response includes complete cleanup metrics fields and details array.', async () => {
    const staleDate = new Date('2020-01-01T00:00:00.000Z');
    const serviceContext = createCleanupContext({
      subscriptions: [{ clinicId, subscriptionStatus: RegistrationStatus.PENDING_PAYMENT, createdAt: staleDate }],
    });

    const result = await AdminService.prototype.cleanupStaleRegistrations.call(serviceContext);

    expect(result).toEqual(
      expect.objectContaining({
        totalStaleFound: expect.any(Number),
        emailsSentSuccessfully: expect.any(Number),
        emailsFailed: expect.any(Number),
        deletedSuccessfully: expect.any(Number),
        deletionsFailed: expect.any(Number),
        details: expect.any(Array),
      }),
    );
  });

  it('UT-103-05: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController);

    expect(guards).toHaveLength(2);
  });

  it('UT-103-06: Non-admin role blocked.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminController.prototype.cleanupStaleRegistrations);

    expect(roles).toEqual([AccountRole.ADMIN]);
  });

  it('UT-103-07: Clinic admin account missing for stale subscription.', async () => {
    const staleDate = new Date('2020-01-01T00:00:00.000Z');
    const serviceContext = createCleanupContext({
      subscriptions: [{ clinicId, subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP, createdAt: staleDate }],
      missingClinicIds: [clinicId],
    });

    const result = await AdminService.prototype.cleanupStaleRegistrations.call(serviceContext);

    expect(result.deletionsFailed).toBe(1);
    expect(result.details[0].error).toBe('Clinic admin account not found');
  });

  it('UT-103-08: Deletion transaction failure recorded in details with failed counter.', async () => {
    const staleDate = new Date('2020-01-01T00:00:00.000Z');
    const serviceContext = createCleanupContext({
      subscriptions: [{ clinicId, subscriptionStatus: RegistrationStatus.PENDING_SEPAY_SETUP, createdAt: staleDate }],
      deleteFailClinicIds: [clinicId],
    });

    const result = await AdminService.prototype.cleanupStaleRegistrations.call(serviceContext);

    expect(result.deletedSuccessfully).toBe(0);
    expect(result.deletionsFailed).toBe(1);
    expect(result.details[0].deleted).toBe(false);
    expect(result.details[0].error).toContain('delete failed');
  });

  it('UT-103-09: Repository runtime error during stale search causes server error.', async () => {
    const serviceContext = createCleanupContext({ staleSearchReject: 'db failed' });

    await expect(AdminService.prototype.cleanupStaleRegistrations.call(serviceContext)).rejects.toThrow('db failed');
  });

  it('UT-103-10: Mailer runtime failure increments email failed counter.', async () => {
    const staleDate = new Date('2020-01-01T00:00:00.000Z');
    const serviceContext = createCleanupContext({
      subscriptions: [{ clinicId, subscriptionStatus: RegistrationStatus.PENDING_LEGAL_SETUP, createdAt: staleDate }],
      mailFailClinicIds: [clinicId],
    });

    const result = await AdminService.prototype.cleanupStaleRegistrations.call(serviceContext);

    expect(result.emailsSentSuccessfully).toBe(0);
    expect(result.emailsFailed).toBe(1);
  });

  it('UT-103-11: Subscription created exactly six months boundary is excluded from stale cleanup seam.', async () => {
    const nearBoundaryDate = new Date(subtractFromVietnamTime(6, 'month').getTime() + 1);
    const serviceContext = createCleanupContext({
      subscriptions: [{ clinicId, subscriptionStatus: RegistrationStatus.PENDING_PAYMENT, createdAt: nearBoundaryDate }],
    });

    const result = await AdminService.prototype.cleanupStaleRegistrations.call(serviceContext);

    expect(result.totalStaleFound).toBe(0);
    expect(result.deletedSuccessfully).toBe(0);
  });

  it('UT-103-12: Large stale dataset still returns aggregated metrics.', async () => {
    const staleDate = new Date('2020-01-01T00:00:00.000Z');
    const subscriptions = Array.from({ length: 30 }, (_, i) => ({
      clinicId: `clinic-${i}`,
      subscriptionStatus: RegistrationStatus.PENDING_APPROVAL,
      createdAt: staleDate,
    }));
    const serviceContext = createCleanupContext({ subscriptions });

    const result = await AdminService.prototype.cleanupStaleRegistrations.call(serviceContext);

    expect(result.totalStaleFound).toBe(30);
    expect(result.deletedSuccessfully + result.deletionsFailed).toBe(30);
  });
});
