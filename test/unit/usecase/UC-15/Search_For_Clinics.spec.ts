import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../../src/modules/accounts/enums/account-status.enum';

describe('UC-15 Search For Clinics', () => {
  const createClinic = (overrides: Record<string, unknown> = {}) => ({
    _id: 'clinic-1',
    username: 'city-medical-branch',
    email: 'branch@example.com',
    role: AccountRole.CLINIC_MANAGER,
    status: AccountStatus.ACTIVE,
    clinicManagerInformation: {
      _id: 'manager-info-1',
      clinicBranchName: 'District 1',
      fullName: 'District 1 Clinic',
      gender: 'MALE',
      profilePicture: null,
      dob: null,
    },
    address: {
      _id: 'address-1',
      address: '1 Nguyen Hue',
      ward: 'ward-code',
      wardName: 'Ben Nghe',
      district: 'district-code',
      districtName: 'District 1',
      province: '79',
      provinceName: 'Ho Chi Minh City',
    },
    parent: {
      clinicAdminInformation: {
        clinicName: 'City Medical',
      },
    },
    ...overrides,
  });

  const createServiceContext = () => ({
    accountRepository: {
      findClinicsWithFilters: jest.fn(),
    },
    dataSource: {
      query: jest.fn(),
    },
  });

  it('UT-15-01: Retrieve default clinic search list successfully.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsWithFilters.mockResolvedValue([[], 0]);
    const controller = new AccountsController({
      findAllClinicsManager: jest.fn().mockResolvedValue({
        clinics: [{ id: 'clinic-1' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    } as any);

    const result = await controller.getAllClinicsManager(1, 10);

    expect(result.message).toBe('Clinics retrieved successfully');
    await AccountsService.prototype.findAllClinicsManager.call(
      serviceContext,
      1,
      10,
    );
    expect(serviceContext.accountRepository.findClinicsWithFilters).toHaveBeenCalledWith(
      AccountRole.CLINIC_MANAGER,
      AccountStatus.ACTIVE,
      0,
      10,
      undefined,
      undefined,
      undefined,
    );
  });

  it('UT-15-02: Retrieve clinics by search keyword successfully.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsWithFilters.mockResolvedValue([
      [createClinic()],
      1,
    ]);
    serviceContext.dataSource.query.mockResolvedValue([
      { clinic_id: 'clinic-1', avg_rating: '4.50' },
    ]);

    const result = await AccountsService.prototype.findAllClinicsManager.call(
      serviceContext,
      1,
      10,
      'City Medical',
    );

    expect(serviceContext.accountRepository.findClinicsWithFilters).toHaveBeenCalledWith(
      AccountRole.CLINIC_MANAGER,
      AccountStatus.ACTIVE,
      0,
      10,
      'City Medical',
      undefined,
      undefined,
    );
    expect(result.clinics[0].clinicInfo.clinicBranchName).toBe('City Medical - District 1');
    expect(result.clinics[0].averageRating).toBe(4.5);
  });

  it('UT-15-03: Retrieve clinics by province successfully.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsWithFilters.mockResolvedValue([
      [createClinic()],
      1,
    ]);
    serviceContext.dataSource.query.mockResolvedValue([]);

    await AccountsService.prototype.findAllClinicsManager.call(
      serviceContext,
      1,
      10,
      undefined,
      '79',
    );

    expect(serviceContext.accountRepository.findClinicsWithFilters).toHaveBeenCalledWith(
      AccountRole.CLINIC_MANAGER,
      AccountStatus.ACTIVE,
      0,
      10,
      undefined,
      '79',
      undefined,
    );
  });

  it('UT-15-04: Retrieve clinics by specialty successfully.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsWithFilters.mockResolvedValue([
      [createClinic()],
      1,
    ]);
    serviceContext.dataSource.query.mockResolvedValue([]);

    await AccountsService.prototype.findAllClinicsManager.call(
      serviceContext,
      1,
      10,
      undefined,
      undefined,
      'Cardiology',
    );

    expect(serviceContext.accountRepository.findClinicsWithFilters).toHaveBeenCalledWith(
      AccountRole.CLINIC_MANAGER,
      AccountStatus.ACTIVE,
      0,
      10,
      undefined,
      undefined,
      'Cardiology',
    );
  });

  it('UT-15-05: Bubble repository failure as internal server error.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsWithFilters.mockRejectedValue(
      new Error('database read failed'),
    );

    await expect(
      AccountsService.prototype.findAllClinicsManager.call(serviceContext, 1, 10),
    ).rejects.toThrow('database read failed');
  });

  it('UT-15-06: Return empty list when no clinics match keyword.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsWithFilters.mockResolvedValue([[], 0]);

    const result = await AccountsService.prototype.findAllClinicsManager.call(
      serviceContext,
      1,
      10,
      'nonexistent_clinic_name',
    );

    expect(result).toEqual({
      clinics: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('UT-15-07: Return empty list when database has no functional clinics.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsWithFilters.mockResolvedValue([[], 0]);

    const result = await AccountsService.prototype.findAllClinicsManager.call(
      serviceContext,
      1,
      10,
    );

    expect(result.clinics).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it('UT-15-08: Return empty page when page exceeds available data.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsWithFilters.mockResolvedValue([[], 1]);

    const result = await AccountsService.prototype.findAllClinicsManager.call(
      serviceContext,
      999,
      10,
    );

    expect(result.pagination).toEqual({
      page: 999,
      limit: 10,
      total: 1,
      totalPages: 0,
    });
  });

  it('UT-15-09: Return one clinic when limit is 1.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsWithFilters.mockResolvedValue([
      [createClinic()],
      3,
    ]);
    serviceContext.dataSource.query.mockResolvedValue([]);

    const result = await AccountsService.prototype.findAllClinicsManager.call(
      serviceContext,
      1,
      1,
    );

    expect(result.clinics).toHaveLength(1);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 3,
      totalPages: 3,
    });
  });
});
