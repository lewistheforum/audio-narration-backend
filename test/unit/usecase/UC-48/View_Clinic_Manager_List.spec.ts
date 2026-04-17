import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { ClinicManagerController } from '../../../../src/modules/accounts/api-clinic-admin/clinic-manager.controller';
import { ClinicManagerService } from '../../../../src/modules/accounts/api-clinic-admin/clinic-manager.service';
import { GetManagerListQueryDto } from '../../../../src/modules/accounts/dto/get-manager-list-query.dto';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { LegalDocumentVerificationStatus } from '../../../../src/modules/accounts/enums/legal-document-verification-status.enum';
import { ClinicManagerInformationRepository } from '../../../../src/modules/accounts/repositories/clinic-manager-information.repository';

describe('UC-48 View Clinic Manager List', () => {
  const createManager = (overrides: Record<string, any> = {}) => ({
    fullName: 'Nguyen Van A',
    clinicBranchName: 'Branch A',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    account: {
      _id: 'manager-1',
      email: 'manager@clinic.com',
      status: AccountStatus.ACTIVE,
      legalDocuments: {
        verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
      },
      address: { provinceName: 'Ho Chi Minh' },
    },
    staffCount: '2',
    doctorCount: '3',
    ...overrides,
  });

  const createServiceContext = ({
    admin = { _id: 'admin-1', role: AccountRole.CLINIC_ADMIN },
    managers = [createManager()],
    total = 1,
  }: {
    admin?: any;
    managers?: any[];
    total?: number;
  } = {}) => ({
    accountRepository: {
      findAccountById: jest.fn().mockResolvedValue(admin),
    },
    managerInfoRepository: {
      findManagersByAdminWithPagination: jest.fn().mockResolvedValue([managers, total]),
    },
  }) as any;

  const collectMessages = async (dto: object) => {
    const errors = await validate(plainToInstance(GetManagerListQueryDto, dto));
    return errors.flatMap((error) => Object.values(error.constraints ?? {}));
  };

  it('UT-48-01: View manager list successfully with default query.', async () => {
    const controllerContext = {
      clinicManagerService: {
        getManagerList: jest.fn().mockResolvedValue({
          data: [],
          meta: { currentPage: 1, itemsPerPage: 10, totalItems: 0, totalPages: 0 },
        }),
      },
    } as any;

    const result = await ClinicManagerController.prototype.getManagerList.call(
      controllerContext,
      { user: { _id: 'admin-1' } },
      { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'DESC' },
    );

    expect(result.message).toBe('Manager list retrieved successfully');
    expect(controllerContext.clinicManagerService.getManagerList).toHaveBeenCalledWith('admin-1', {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });
  });

  it('UT-48-02: View manager list with combined filters.', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicManagerService.prototype.getManagerList.call(serviceContext, 'admin-1', {
      page: 1,
      limit: 10,
      sortBy: 'email',
      sortOrder: 'ASC',
      fullName: 'Nguyen',
      clinicBranchName: 'Branch A',
      email: 'manager@clinic.com',
      status: AccountStatus.ACTIVE,
      legalDocStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
      province: 'Ho Chi Minh',
    });

    expect(serviceContext.managerInfoRepository.findManagersByAdminWithPagination).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({ sortBy: 'email', sortOrder: 'ASC', fullName: 'Nguyen' }),
    );
    expect(result.data[0]).toMatchObject({
      managerId: 'manager-1',
      fullName: 'Nguyen Van A',
      legalDocStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
      province: 'Ho Chi Minh',
    });
  });

  it('UT-48-03: View manager list with NOT_SUBMITTED legal document filter.', async () => {
    const serviceContext = createServiceContext({
      managers: [
        createManager({
          account: {
            _id: 'manager-1',
            email: 'manager@clinic.com',
            status: AccountStatus.ACTIVE,
            legalDocuments: null,
            address: null,
          },
        }),
      ],
    });

    const result = await ClinicManagerService.prototype.getManagerList.call(serviceContext, 'admin-1', {
      legalDocStatus: LegalDocumentVerificationStatus.NOT_SUBMITTED,
    });

    expect(result.data[0].legalDocStatus).toBe(LegalDocumentVerificationStatus.NOT_SUBMITTED);
    expect(result.data[0].province).toBe('N/A');
  });

  it('UT-48-04: View manager list successfully with upper limit boundary.', async () => {
    const serviceContext = createServiceContext({ total: 1 });

    const result = await ClinicManagerService.prototype.getManagerList.call(serviceContext, 'admin-1', {
      page: 1,
      limit: 100,
    });

    expect(result.meta).toEqual({ currentPage: 1, itemsPerPage: 100, totalItems: 1, totalPages: 1 });
  });

  it('UT-48-05: Reject manager list request without JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ClinicManagerController);

    expect(guards).toHaveLength(2);
  });

  it('UT-48-06: Reject non-admin role by RBAC.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ClinicManagerController.prototype.getManagerList);

    expect(roles).toEqual([AccountRole.CLINIC_ADMIN]);
  });

  it('UT-48-07: Reject invalid pagination (page, limit).', async () => {
    const messages = await collectMessages({ page: 0, limit: 0 });

    expect(messages).toContain('page must not be less than 1');
    expect(messages).toContain('limit must not be less than 1');
  });

  it('UT-48-08: Reject invalid enum and invalid field types in query.', async () => {
    const messages = await collectMessages({
      limit: 101,
      sortOrder: 'DOWN',
      fullName: 123,
      clinicBranchName: 123,
      email: 123,
      status: 'INVALID_STATUS',
      legalDocStatus: 123,
      province: 123,
    });

    expect(messages).toContain('limit must not be greater than 100');
    expect(messages).toContain('sortOrder must be one of the following values: ');
    expect(messages).toContain('fullName must be a string');
    expect(messages).toContain('clinicBranchName must be a string');
    expect(messages).toContain('email must be a string');
    expect(messages).toContain(
      'status must be one of the following values: UNVERIFIED, ACTIVE, DELETED, BAN, PENDING_APPROVAL, MANAGER_DISABLED',
    );
    expect(messages).toContain('legalDocStatus must be a string');
    expect(messages).toContain('province must be a string');
  });

  it('UT-48-09: Reject when service validates requester is not clinic admin.', async () => {
    const serviceContext = createServiceContext({
      admin: { _id: 'manager-1', role: AccountRole.CLINIC_MANAGER },
    });

    await expect(
      ClinicManagerService.prototype.getManagerList.call(serviceContext, 'manager-1', {}),
    ).rejects.toThrow(new ForbiddenException('Only clinic admins can view manager list'));
  });

  it('UT-48-10: Return internal error when repository query fails.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.managerInfoRepository.findManagersByAdminWithPagination.mockRejectedValue(
      new Error('db failed'),
    );

    await expect(
      ClinicManagerService.prototype.getManagerList.call(serviceContext, 'admin-1', {}),
    ).rejects.toThrow('db failed');
  });

  it('UT-48-11: Use fallback sorting when sortBy is unknown.', async () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getRawAndEntities: jest.fn().mockResolvedValue({ raw: [], entities: [] }),
      getCount: jest.fn().mockResolvedValue(0),
    };
    const repositoryContext = {
      repository: {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      },
    } as any;

    await ClinicManagerInformationRepository.prototype.findManagersByAdminWithPagination.call(
      repositoryContext,
      'admin-1',
      { sortBy: 'unknownField', sortOrder: 'DESC' },
    );

    expect(queryBuilder.orderBy).toHaveBeenCalledWith('manager.createdAt', 'DESC');
  });

  it('UT-48-12: Return empty data for page far beyond total pages.', async () => {
    const serviceContext = createServiceContext({ managers: [], total: 0 });

    const result = await ClinicManagerService.prototype.getManagerList.call(serviceContext, 'admin-1', {
      page: 999,
      limit: 10,
    });

    expect(result).toEqual({
      data: [],
      meta: { currentPage: 999, itemsPerPage: 10, totalItems: 0, totalPages: 0 },
    });
  });
});
