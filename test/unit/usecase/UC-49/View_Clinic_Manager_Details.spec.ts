import { ForbiddenException, NotFoundException, ParseUUIDPipe } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { ClinicManagerController } from '../../../../src/modules/accounts/api-clinic-admin/clinic-manager.controller';
import { ClinicManagerService } from '../../../../src/modules/accounts/api-clinic-admin/clinic-manager.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';
import { LegalDocumentVerificationStatus } from '../../../../src/modules/accounts/enums/legal-document-verification-status.enum';

describe('UC-49 View Clinic Manager Details', () => {
  const createManagerDetail = (overrides: Record<string, any> = {}) => ({
    fullName: 'Manager One',
    clinicBranchName: 'Branch A',
    gender: 'MALE',
    dob: new Date('1990-01-01T00:00:00.000Z'),
    profilePicture: 'avatar.png',
    account: {
      _id: 'manager-1',
      parentId: 'admin-1',
      email: 'manager@clinic.com',
      status: AccountStatus.ACTIVE,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      address: {
        address: '123 Street',
        wardName: 'Ward 1',
        districtName: 'District 1',
        provinceName: 'HCM',
        googleIframe: { googleMapIframe: 'iframe' },
      },
      legalDocuments: {
        operatingLicense: 'op-license',
        businessLicense: 'biz-license',
        taxIdUrl: 'tax-id',
        verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
        rejectionReason: null,
        updatedAt: new Date('2026-01-03T00:00:00.000Z'),
      },
      children: [
        {
          _id: 'doctor-1',
          role: AccountRole.DOCTOR,
          email: 'doctor@clinic.com',
          status: AccountStatus.ACTIVE,
          deletedAt: null,
          doctorInformation: { specialization: 'Cardiology', fullName: 'Dr. John' },
        },
        {
          _id: 'staff-1',
          role: AccountRole.CLINIC_STAFF,
          email: 'staff@clinic.com',
          status: AccountStatus.ACTIVE,
          deletedAt: null,
          clinicStaffInformation: { clinicRole: 'RECEPTIONIST', fullName: 'Staff One' },
        },
        {
          _id: 'deleted-child',
          role: AccountRole.CLINIC_STAFF,
          email: 'deleted@clinic.com',
          status: AccountStatus.ACTIVE,
          deletedAt: new Date(),
          clinicStaffInformation: { clinicRole: 'NURSE', fullName: 'Deleted Staff' },
        },
      ],
    },
    ...overrides,
  });

  const createServiceContext = (manager = createManagerDetail()) => ({
    managerInfoRepository: {
      findManagerDetailById: jest.fn().mockResolvedValue(manager),
    },
  }) as any;

  it('UT-49-01: Owner clinic admin views manager detail successfully.', async () => {
    const controllerContext = {
      clinicManagerService: {
        getManagerDetail: jest.fn().mockResolvedValue({ managerId: 'manager-1' }),
      },
    } as any;

    const result = await ClinicManagerController.prototype.getManagerDetail.call(
      controllerContext,
      { user: { _id: 'admin-1', role: AccountRole.CLINIC_ADMIN } },
      'manager-1',
    );

    expect(controllerContext.clinicManagerService.getManagerDetail).toHaveBeenCalledWith(
      'admin-1',
      AccountRole.CLINIC_ADMIN,
      'manager-1',
    );
    expect(result).toEqual({
      data: { managerId: 'manager-1' },
      message: 'Manager details retrieved successfully',
    });
  });

  it('UT-49-02: Manager views own detail successfully.', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicManagerService.prototype.getManagerDetail.call(
      serviceContext,
      'manager-1',
      AccountRole.CLINIC_MANAGER,
      'manager-1',
    );

    expect(result.managerId).toBe('manager-1');
    expect(result.fullName).toBe('Manager One');
  });

  it('UT-49-03: Return personnel list for non-pending manager with deleted children filtered out.', async () => {
    const serviceContext = createServiceContext();

    const result = await ClinicManagerService.prototype.getManagerDetail.call(
      serviceContext,
      'admin-1',
      AccountRole.CLINIC_ADMIN,
      'manager-1',
    );

    expect(result.personnel).toHaveLength(2);
    expect(result.personnel).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: 'doctor-1', specialization: 'Cardiology' }),
        expect.objectContaining({ accountId: 'staff-1', clinicRole: 'RECEPTIONIST' }),
      ]),
    );
  });

  it('UT-49-04: Reject request without JWT.', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, ClinicManagerController);

    expect(guards).toHaveLength(2);
  });

  it('UT-49-05: Reject unauthorized role by RolesGuard.', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, ClinicManagerController.prototype.getManagerDetail);

    expect(roles).toEqual([AccountRole.CLINIC_ADMIN, AccountRole.CLINIC_MANAGER]);
  });

  it('UT-49-06: Reject invalid manager UUID format.', async () => {
    const pipe = new ParseUUIDPipe();

    await expect(pipe.transform('invalid_uuid', {} as any)).rejects.toThrow(
      'Validation failed (uuid is expected)',
    );
  });

  it('UT-49-07: Reject access when requester is not owner and not self.', async () => {
    const serviceContext = createServiceContext();

    await expect(
      ClinicManagerService.prototype.getManagerDetail.call(
        serviceContext,
        'admin-2',
        AccountRole.CLINIC_ADMIN,
        'manager-1',
      ),
    ).rejects.toThrow(new ForbiddenException('You do not have access to this manager'));
  });

  it('UT-49-08: Return not found when manager does not exist.', async () => {
    const serviceContext = createServiceContext(null);

    await expect(
      ClinicManagerService.prototype.getManagerDetail.call(
        serviceContext,
        'admin-1',
        AccountRole.CLINIC_ADMIN,
        'manager-missing',
      ),
    ).rejects.toThrow(new NotFoundException('Manager not found'));
  });

  it('UT-49-09: Return empty personnel when manager is PENDING_APPROVAL.', async () => {
    const serviceContext = createServiceContext(
      createManagerDetail({
        account: {
          ...createManagerDetail().account,
          status: AccountStatus.PENDING_APPROVAL,
        },
      }),
    );

    const result = await ClinicManagerService.prototype.getManagerDetail.call(
      serviceContext,
      'admin-1',
      AccountRole.CLINIC_ADMIN,
      'manager-1',
    );

    expect(result.personnel).toEqual([]);
  });

  it('UT-49-10: Return fallback values for missing address and legal docs relations.', async () => {
    const serviceContext = createServiceContext(
      createManagerDetail({
        account: {
          ...createManagerDetail().account,
          address: null,
          legalDocuments: null,
          children: [],
        },
      }),
    );

    const result = await ClinicManagerService.prototype.getManagerDetail.call(
      serviceContext,
      'admin-1',
      AccountRole.CLINIC_ADMIN,
      'manager-1',
    );

    expect(result.address).toEqual({
      address: '',
      wardName: '',
      districtName: '',
      provinceName: '',
      googleMapIframe: null,
    });
    expect(result.legalDocuments.verificationStatus).toBe(
      LegalDocumentVerificationStatus.NOT_SUBMITTED,
    );
  });
});
