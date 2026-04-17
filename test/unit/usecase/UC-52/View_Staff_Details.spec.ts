import { ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-52 View Staff Details', () => {
  const createServiceContext = ({
    staff = { _id: 'staff-1', parentId: 'manager-1' },
    parent = { _id: 'manager-1', parentId: 'clinic-admin-1' },
    managers = [{ _id: 'manager-1' }, { _id: 'manager-2' }],
  }: {
    staff?: any;
    parent?: any;
    managers?: any[];
  } = {}) => ({
    findAccountEntityById: jest.fn().mockResolvedValue(staff),
    getAccountInformationByRole: jest.fn().mockResolvedValue({ _id: 'staff-1', email: 'staff@clinic.com' }),
    accountRepository: {
      findAccountById: jest.fn().mockResolvedValue(parent),
      findByParentIdAndRole: jest.fn().mockResolvedValue(managers),
    },
  }) as any;

  it('UT-52-01: View staff details successfully in same clinic scope.', async () => {
    const controllerContext = {
      accountsService: {
        findStaffById: jest.fn().mockResolvedValue({ _id: 'staff-1' }),
      },
    } as any;

    const result = await AccountsController.prototype.getStaffDetails.call(
      controllerContext,
      { user: { _id: 'manager-1' } },
      'staff-1',
    );

    expect(controllerContext.accountsService.findStaffById).toHaveBeenCalledWith('staff-1', 'manager-1');
    expect(result).toEqual({
      data: { _id: 'staff-1' },
      message: 'Staff details retrieved successfully',
    });
  });

  it('UT-52-02: View staff details when valid parent set includes clinic admin id.', async () => {
    const serviceContext = createServiceContext({
      staff: { _id: 'staff-1', parentId: 'clinic-admin-1' },
    });

    const result = await AccountsService.prototype.findStaffById.call(
      serviceContext,
      'staff-1',
      'manager-1',
    );

    expect(result).toEqual({ _id: 'staff-1', email: 'staff@clinic.com' });
  });

  it('UT-52-03: Reject request without JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AccountsController.prototype.getStaffDetails);

    expect(guards).toHaveLength(2);
  });

  it('UT-52-04: Reject non-manager role by RolesGuard.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AccountsController.prototype.getStaffDetails);

    expect(roles).toEqual([AccountRole.CLINIC_MANAGER]);
  });

  it('UT-52-05: Reject invalid staff UUID format.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });

  it('UT-52-06: Return not found when staff account does not exist.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.findAccountEntityById.mockRejectedValue(new NotFoundException('User not found'));

    await expect(
      AccountsService.prototype.findStaffById.call(serviceContext, 'staff-missing', 'manager-1'),
    ).rejects.toThrow(new NotFoundException('User not found'));
  });

  it('UT-52-07: Return forbidden when manager account cannot be resolved.', async () => {
    const serviceContext = createServiceContext({ parent: null });

    await expect(
      AccountsService.prototype.findStaffById.call(serviceContext, 'staff-1', 'manager-1'),
    ).rejects.toThrow(new ForbiddenException('User not found'));
  });

  it('UT-52-08: Return forbidden when staff is outside manager clinic scope.', async () => {
    const serviceContext = createServiceContext({
      staff: { _id: 'staff-1', parentId: 'other-clinic-manager' },
    });

    await expect(
      AccountsService.prototype.findStaffById.call(serviceContext, 'staff-1', 'manager-1'),
    ).rejects.toThrow(new ForbiddenException('You do not have permission to perform this action'));
  });

  it('UT-52-09: Return internal error on repository failure.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findByParentIdAndRole.mockRejectedValue(new Error('db failed'));

    await expect(
      AccountsService.prototype.findStaffById.call(serviceContext, 'staff-1', 'manager-1'),
    ).rejects.toThrow('db failed');
  });
});
