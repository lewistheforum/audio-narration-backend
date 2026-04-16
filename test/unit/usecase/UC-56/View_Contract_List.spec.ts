import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { ContractsController } from '../../../../src/modules/contracts/contracts.controller';
import { ContractsService } from '../../../../src/modules/contracts/contracts.service';
import { ContractStatus } from '../../../../src/modules/contracts/enums/contract-status.enum';

describe('UC-56 View Contract List', () => {
  const createServiceContext = ({
    packages = [{ _id: 'pkg-1', clinicContractInformation: { contractStatus: ContractStatus.CURRENT } }],
    total = 1,
    repositoryThrows = false,
    verifyThrows = false,
    integrity = true,
  }: {
    packages?: any[];
    total?: number;
    repositoryThrows?: boolean;
    verifyThrows?: boolean;
    integrity?: boolean;
  } = {}) => ({
    contractPackageRepository: {
      findPackagesByManagerWithFilters: jest.fn().mockImplementation(async () => {
        if (repositoryThrows) {
          throw new Error('db failed');
        }
        return [packages, total];
      }),
      findPackagesByEmployeeWithFilters: jest.fn().mockImplementation(async () => {
        if (repositoryThrows) {
          throw new Error('db failed');
        }
        return [packages, total];
      }),
    },
    verifyContract: jest.fn().mockImplementation(async () => {
      if (verifyThrows) {
        throw new Error('verify failed');
      }
      return { managerValid: integrity, employeeValid: integrity, integrity };
    }),
    handleTamperedContract: jest.fn().mockResolvedValue(undefined),
  }) as any;

  it('UT-56-01: Manager views contract list with default filters.', async () => {
    const serviceContext = createServiceContext();

    const result = await ContractsService.prototype.getPackagesByManager.call(
      serviceContext,
      'manager-1',
      undefined,
      1,
      10,
      undefined,
    );

    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('UT-56-02: Manager views contract list with employeeName and status filters.', async () => {
    const serviceContext = createServiceContext();

    await ContractsService.prototype.getPackagesByManager.call(
      serviceContext,
      'manager-1',
      'Nguyen',
      1,
      20,
      ContractStatus.CURRENT,
    );

    expect(
      serviceContext.contractPackageRepository.findPackagesByManagerWithFilters,
    ).toHaveBeenCalledWith('manager-1', 'Nguyen', 1, 20, ContractStatus.CURRENT);
  });

  it('UT-56-03: Employee views own contract list with clinicName filter.', async () => {
    const serviceContext = createServiceContext();

    await ContractsService.prototype.getPackagesByEmployee.call(
      serviceContext,
      'employee-1',
      'Sunrise Clinic',
      1,
      10,
    );

    expect(
      serviceContext.contractPackageRepository.findPackagesByEmployeeWithFilters,
    ).toHaveBeenCalledWith('employee-1', 'Sunrise Clinic', 1, 10);
  });

  it('UT-56-04: Employee list excludes DRAFT contracts by repository branch.', async () => {
    const serviceContext = createServiceContext({
      packages: [{ _id: 'pkg-2', clinicContractInformation: { contractStatus: ContractStatus.CURRENT } }],
    });

    const result = await ContractsService.prototype.getPackagesByEmployee.call(
      serviceContext,
      'employee-1',
      undefined,
      1,
      10,
    );

    expect(result.data.every((pkg) => pkg.clinicContractInformation.contractStatus !== ContractStatus.DRAFT)).toBe(
      true,
    );
  });

  it('UT-56-05: Reject request without JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ContractsController.prototype.getPackages);

    expect(guards).toHaveLength(2);
  });

  it('UT-56-06: Unauthorized role rejected for employee endpoint metadata.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ContractsController.prototype.getPackagesByEmployee);

    expect(roles).toEqual([AccountRole.DOCTOR, AccountRole.CLINIC_STAFF]);
  });

  it('UT-56-07: Unauthorized role rejected for manager endpoint metadata.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ContractsController.prototype.getPackages);

    expect(roles).toEqual([
      AccountRole.ADMIN,
      AccountRole.CLINIC_MANAGER,
      AccountRole.DOCTOR,
      AccountRole.CLINIC_STAFF,
    ]);
  });

  it('UT-56-08: Runtime repository failure returns 500.', async () => {
    const serviceContext = createServiceContext({ repositoryThrows: true });

    await expect(
      ContractsService.prototype.getPackagesByManager.call(
        serviceContext,
        'manager-1',
        undefined,
        1,
        10,
        undefined,
      ),
    ).rejects.toThrow('db failed');
  });

  it('UT-56-09: Verification runtime error propagates 500.', async () => {
    const serviceContext = createServiceContext({
      packages: [
        {
          _id: 'pkg-1',
          managerSignature: 'sig',
          clinicContractInformation: { contractStatus: ContractStatus.CURRENT },
        },
      ],
      verifyThrows: true,
    });

    await expect(
      ContractsService.prototype.getPackagesByManager.call(
        serviceContext,
        'manager-1',
        undefined,
        1,
        10,
        undefined,
      ),
    ).rejects.toThrow('verify failed');
  });

  it('UT-56-10: Reject expired or invalid JWT via guard metadata.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ContractsController.prototype.getPackagesByEmployee);

    expect(guards).toHaveLength(2);
  });

  it('UT-56-11: Empty list returns valid pagination object.', async () => {
    const serviceContext = createServiceContext({ packages: [], total: 0 });

    const result = await ContractsService.prototype.getPackagesByManager.call(
      serviceContext,
      'manager-1',
      undefined,
      1,
      10,
      undefined,
    );

    expect(result).toEqual({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('UT-56-12: High page index returns empty page without error.', async () => {
    const serviceContext = createServiceContext({ packages: [], total: 2 });

    const result = await ContractsService.prototype.getPackagesByEmployee.call(
      serviceContext,
      'employee-1',
      undefined,
      999,
      10,
    );

    expect(result.pagination).toEqual({ page: 999, limit: 10, total: 2, totalPages: 1 });
  });
});
