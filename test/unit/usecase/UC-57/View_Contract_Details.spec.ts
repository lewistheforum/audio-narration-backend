import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { ContractsController } from '../../../../src/modules/contracts/contracts.controller';
import { ContractsService } from '../../../../src/modules/contracts/contracts.service';
import { ContractStatus } from '../../../../src/modules/contracts/enums/contract-status.enum';

describe('UC-57 View Contract Details', () => {
  const createContract = (overrides: any = {}) => ({
    _id: 'pkg-1',
    employeeId: 'employee-1',
    clinicManagerId: 'manager-1',
    clinicContractInformation: { contractStatus: ContractStatus.CURRENT },
    employeeSignature: undefined,
    managerSignature: undefined,
    ...overrides,
  });

  const createServiceContext = ({
    contract = createContract(),
    verifyResult = { managerValid: true, employeeValid: true, integrity: true },
    verifyThrows = false,
  }: {
    contract?: any;
    verifyResult?: any;
    verifyThrows?: boolean;
  } = {}) => ({
    contractPackageRepository: {
      findById: jest.fn().mockResolvedValue(contract),
    },
    verifyContract: jest.fn().mockImplementation(async () => {
      if (verifyThrows) {
        throw new Error('verify failed');
      }
      return verifyResult;
    }),
    handleTamperedContract: jest.fn().mockResolvedValue(undefined),
  }) as any;

  it('UT-57-01: Manager/Admin view contract package by id.', async () => {
    const serviceContext = createServiceContext();

    const result = await ContractsService.prototype.getPackageById.call(serviceContext, 'pkg-1');

    expect(result._id).toBe('pkg-1');
  });

  it('UT-57-02: Employee views own contract detail.', async () => {
    const serviceContext = createServiceContext();

    const result = await ContractsService.prototype.getMyContract.call(
      serviceContext,
      'employee-1',
      'pkg-1',
    );

    expect(result._id).toBe('pkg-1');
  });

  it('UT-57-03: Signed contract passes integrity verify branch.', async () => {
    const serviceContext = createServiceContext({
      contract: createContract({ employeeSignature: 'sig', managerSignature: 'sig2' }),
      verifyResult: { managerValid: true, employeeValid: true, integrity: true },
    });

    await ContractsService.prototype.getPackageById.call(serviceContext, 'pkg-1');

    expect(serviceContext.verifyContract).toHaveBeenCalledWith('pkg-1');
    expect(serviceContext.handleTamperedContract).not.toHaveBeenCalled();
  });

  it('UT-57-04: Unsiged package returns without verify failure.', async () => {
    const serviceContext = createServiceContext({
      contract: createContract({ employeeSignature: undefined, managerSignature: undefined }),
    });

    await ContractsService.prototype.getPackageById.call(serviceContext, 'pkg-1');

    expect(serviceContext.verifyContract).toHaveBeenCalled();
    expect(serviceContext.handleTamperedContract).not.toHaveBeenCalled();
  });

  it('UT-57-05: Reject request without JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ContractsController.prototype.getPackageById);

    expect(guards).toHaveLength(2);
  });

  it('UT-57-06: Reject by RolesGuard for unauthorized role metadata.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ContractsController.prototype.getPackageById);

    expect(roles).toEqual([
      AccountRole.ADMIN,
      AccountRole.CLINIC_MANAGER,
      AccountRole.DOCTOR,
      AccountRole.CLINIC_STAFF,
    ]);
  });

  it('UT-57-07: Return not found when package does not exist.', async () => {
    const serviceContext = createServiceContext({ contract: null });

    await expect(
      ContractsService.prototype.getMyContract.call(serviceContext, 'employee-1', 'missing-id'),
    ).rejects.toThrow(new NotFoundException('Contract package not found'));
  });

  it('UT-57-08: Employee forbidden when not owner.', async () => {
    const serviceContext = createServiceContext({
      contract: createContract({ employeeId: 'employee-2' }),
    });

    await expect(
      ContractsService.prototype.getMyContract.call(serviceContext, 'employee-1', 'pkg-1'),
    ).rejects.toThrow(new UnauthorizedException('You do not have access to this contract'));
  });

  it('UT-57-09: Employee blocked when contract still DRAFT.', async () => {
    const serviceContext = createServiceContext({
      contract: createContract({
        clinicContractInformation: { contractStatus: ContractStatus.DRAFT },
      }),
    });

    await expect(
      ContractsService.prototype.getMyContract.call(serviceContext, 'employee-1', 'pkg-1'),
    ).rejects.toThrow(new UnauthorizedException('You do not have access to this contract yet'));
  });

  it('UT-57-10: Tampered integrity branch handled.', async () => {
    const serviceContext = createServiceContext({
      contract: createContract({ employeeSignature: 'sig' }),
      verifyResult: { managerValid: false, employeeValid: false, integrity: false },
    });

    await ContractsService.prototype.getPackageById.call(serviceContext, 'pkg-1');

    expect(serviceContext.handleTamperedContract).toHaveBeenCalled();
  });

  it('UT-57-11: Verify key parsing failure propagates as internal runtime branch.', async () => {
    const serviceContext = createServiceContext({
      contract: createContract({ employeeSignature: 'sig' }),
      verifyThrows: true,
    });

    await expect(
      ContractsService.prototype.getPackageById.call(serviceContext, 'pkg-1'),
    ).rejects.toThrow('verify failed');
  });
});
