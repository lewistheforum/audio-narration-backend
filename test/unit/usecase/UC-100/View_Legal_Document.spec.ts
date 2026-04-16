import { ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AdminController } from '../../../../src/modules/admin/admin.controller';
import { AdminService } from '../../../../src/modules/admin/admin.service';
import { PaginationQueryDto } from '../../../../src/modules/admin/dto/pagination-query.dto';

describe('UC-100 View Legal Document', () => {
  const adminId = '123e4567-e89b-42d3-a456-426614174009';
  const managerId = '123e4567-e89b-42d3-a456-426614174010';

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(PaginationQueryDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-100-01: ADMIN gets pending legal-doc list.', async () => {
    const controller = {
      adminService: {
        getPendingLegalDocuments: jest.fn().mockResolvedValue({ data: [{ id: 'd1' }], pagination: { page: 1, limit: 10 } }),
      },
    } as any;

    const result = await AdminController.prototype.getPendingLegalDocuments.call(controller, {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    expect(controller.adminService.getPendingLegalDocuments).toHaveBeenCalledWith(1, 10, 'createdAt', 'DESC');
    expect(result.data).toHaveLength(1);
  });

  it('UT-100-02: ADMIN gets approved legal-doc list.', async () => {
    const controller = {
      adminService: {
        getApprovedLegalDocuments: jest.fn().mockResolvedValue({ data: [{ id: 'd1' }], pagination: { page: 1, limit: 10 } }),
      },
    } as any;

    const result = await AdminController.prototype.getApprovedLegalDocuments.call(controller, {
      page: 1,
      limit: 10,
      sortBy: 'clinicName',
      sortOrder: 'ASC',
    });

    expect(controller.adminService.getApprovedLegalDocuments).toHaveBeenCalledWith(1, 10, 'clinicName', 'ASC');
    expect(result.pagination.page).toBe(1);
  });

  it('UT-100-03: ADMIN gets rejected/not-submitted legal-doc lists.', async () => {
    const controller = {
      adminService: {
        getRejectedLegalDocuments: jest.fn().mockResolvedValue({ data: [{ id: 'r1' }], pagination: { page: 1, limit: 10 } }),
        getNotSubmittedRegistrations: jest.fn().mockResolvedValue({ data: [{ id: 'n1' }], pagination: { page: 1, limit: 10 } }),
      },
    } as any;

    const rejected = await AdminController.prototype.getRejectedLegalDocuments.call(controller, {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });
    const notSubmitted = await AdminController.prototype.getNotSubmittedRegistrations.call(controller, {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    expect(rejected.data[0].id).toBe('r1');
    expect(notSubmitted.data[0].id).toBe('n1');
  });

  it('UT-100-04: CLINIC_ADMIN gets own manager legal documents.', async () => {
    const context = {
      findAccountEntityById: jest
        .fn()
        .mockResolvedValueOnce({ _id: adminId, role: AccountRole.CLINIC_ADMIN })
        .mockResolvedValueOnce({ _id: managerId, role: AccountRole.CLINIC_MANAGER, parentId: adminId }),
      clinicLegalDocsRepository: {
        findByAccountId: jest.fn().mockResolvedValue({ accountId: managerId, verificationStatus: 'PENDING_REVIEW' }),
      },
    } as any;

    const result = await AccountsService.prototype.getLegalDocumentsForManager.call(context, adminId, managerId);

    expect(result.accountId).toBe(managerId);
  });

  it('UT-100-05: Valid pagination/sort returns expected list payload (including empty list).', async () => {
    const controller = {
      adminService: {
        getNotSubmittedRegistrations: jest.fn().mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0 } }),
      },
    } as any;

    const result = await AdminController.prototype.getNotSubmittedRegistrations.call(controller, {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it('UT-100-06: Missing JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController);

    expect(guards).toHaveLength(2);
  });

  it('UT-100-07: Non-admin role blocked on admin legal endpoints.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminController.prototype.getPendingLegalDocuments);

    expect(roles).toEqual([AccountRole.ADMIN]);
  });

  it('UT-100-08: Non-clinic-admin role blocked on manager document endpoint.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AccountsController.prototype.getLegalDocumentsForManager);

    expect(roles).toEqual([AccountRole.CLINIC_ADMIN]);
  });

  it('UT-100-09: Invalid pagination/sort query values.', async () => {
    const messages = await collectMessages({ page: 0, limit: 101, sortBy: 'invalid', sortOrder: 'INVALID' });

    expect(messages).toContain('page must not be less than 1');
    expect(messages).toContain('limit must not be greater than 100');
    expect(messages.some((m) => m.includes('sortBy must be one of'))).toBe(true);
    expect(messages.some((m) => m.includes('sortOrder must be one of'))).toBe(true);
  });

  it('UT-100-10: Invalid UUID managerAccountId.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow('Validation failed (uuid is expected)');
  });

  it('UT-100-11: Manager not found or wrong role.', async () => {
    const missingManager = {
      findAccountEntityById: jest
        .fn()
        .mockResolvedValueOnce({ _id: adminId, role: AccountRole.CLINIC_ADMIN })
        .mockRejectedValueOnce(new NotFoundException('Account not found')),
    } as any;

    await expect(AccountsService.prototype.getLegalDocumentsForManager.call(missingManager, adminId, managerId)).rejects.toThrow(
      new NotFoundException('Account not found'),
    );

    const wrongRole = {
      findAccountEntityById: jest
        .fn()
        .mockResolvedValueOnce({ _id: adminId, role: AccountRole.CLINIC_ADMIN })
        .mockResolvedValueOnce({ _id: managerId, role: AccountRole.CLINIC_STAFF, parentId: adminId }),
    } as any;

    await expect(AccountsService.prototype.getLegalDocumentsForManager.call(wrongRole, adminId, managerId)).rejects.toThrow(
      new NotFoundException('Clinic manager not found'),
    );
  });

  it('UT-100-12: Ownership violation and runtime failures.', async () => {
    const ownershipContext = {
      findAccountEntityById: jest
        .fn()
        .mockResolvedValueOnce({ _id: adminId, role: AccountRole.CLINIC_ADMIN })
        .mockResolvedValueOnce({ _id: managerId, role: AccountRole.CLINIC_MANAGER, parentId: 'other-admin' }),
    } as any;

    await expect(AccountsService.prototype.getLegalDocumentsForManager.call(ownershipContext, adminId, managerId)).rejects.toThrow(
      new ForbiddenException('You do not have permission to view documents for this manager'),
    );

    const adminServiceContext = {
      adminRegistrationRepository: {
        findPendingLegalDocuments: jest.fn().mockRejectedValue(new Error('db failed')),
      },
    } as any;

    await expect(AdminService.prototype.getPendingLegalDocuments.call(adminServiceContext, 1, 10, 'createdAt', 'DESC')).rejects.toThrow(
      'db failed',
    );
  });

  it('UT-100-13: Boundary limit=100 accepted.', async () => {
    const messages = await collectMessages({ page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'DESC' });

    expect(messages).toEqual([]);
  });

  it('UT-100-14: Boundary page=1 default accepted.', async () => {
    const messages = await collectMessages({});
    const dto = new PaginationQueryDto();

    expect(messages).toEqual([]);
    expect(dto.page).toBe(1);
  });
});
