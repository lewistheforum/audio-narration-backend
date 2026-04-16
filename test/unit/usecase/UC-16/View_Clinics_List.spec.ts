import { AccountsController } from '../../../../src/modules/accounts/accounts.controller';
import { AccountsService } from '../../../../src/modules/accounts/accounts.service';
import { AccountRole } from '../../../../src/modules/accounts/enums/account-role.enum';

describe('UC-16 View Clinics List', () => {
  const createClinic = (overrides: Record<string, unknown> = {}) => ({
    _id: 'clinic-admin-1',
    username: 'city-medical',
    email: 'clinic@example.com',
    phone: '0900000000',
    role: AccountRole.CLINIC_ADMIN,
    status: 'ACTIVE',
    clinicAdminInformation: {
      _id: 'admin-info-1',
      clinicName: 'City Medical',
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
    ...overrides,
  });

  const createServiceContext = () => ({
    accountRepository: {
      findClinicsAdminWithFilters: jest.fn(),
    },
    dataSource: {
      query: jest.fn(),
    },
  });

  it('UT-16-01: Retrieve default clinic-admin list successfully.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsAdminWithFilters.mockResolvedValue([[], 0]);
    serviceContext.dataSource.query.mockResolvedValue([]);
    const controller = new AccountsController({
      findAllClinicsAdmin: jest.fn().mockResolvedValue({
        clinics: [{ id: 'clinic-admin-1' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    } as any);

    const result = await controller.getAllClinicsAdmin(1, 10);

    expect(result.message).toBe('Clinics retrieved successfully');
    await AccountsService.prototype.findAllClinicsAdmin.call(serviceContext, 1, 10);
    expect(serviceContext.accountRepository.findClinicsAdminWithFilters).toHaveBeenCalledWith(
      AccountRole.CLINIC_ADMIN,
      0,
      10,
      undefined,
      undefined,
      undefined,
      false,
    );
  });

  it('UT-16-02: Retrieve clinic-admin list by search keyword successfully.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsAdminWithFilters.mockResolvedValue([
      [createClinic()],
      1,
    ]);
    serviceContext.dataSource.query
      .mockResolvedValueOnce([{ clinic_id: 'clinic-admin-1', avg_rating: '4.25' }])
      .mockResolvedValueOnce([]);

    const result = await AccountsService.prototype.findAllClinicsAdmin.call(
      serviceContext,
      1,
      10,
      'City Medical',
    );

    expect(serviceContext.accountRepository.findClinicsAdminWithFilters).toHaveBeenCalledWith(
      AccountRole.CLINIC_ADMIN,
      0,
      10,
      'City Medical',
      undefined,
      undefined,
      false,
    );
    expect(result.clinics[0].clinicInfo.clinicBranchName).toBe('City Medical');
    expect(result.clinics[0].averageRating).toBe(4.25);
  });

  it('UT-16-03: Retrieve clinic-admin list by province successfully.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsAdminWithFilters.mockResolvedValue([
      [createClinic()],
      1,
    ]);
    serviceContext.dataSource.query.mockResolvedValue([]);

    await AccountsService.prototype.findAllClinicsAdmin.call(
      serviceContext,
      1,
      10,
      undefined,
      '79',
    );

    expect(serviceContext.accountRepository.findClinicsAdminWithFilters).toHaveBeenCalledWith(
      AccountRole.CLINIC_ADMIN,
      0,
      10,
      undefined,
      '79',
      undefined,
      false,
    );
  });

  it('UT-16-04: Retrieve clinic-admin list by specialty successfully.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsAdminWithFilters.mockResolvedValue([
      [createClinic()],
      1,
    ]);
    serviceContext.dataSource.query.mockResolvedValue([]);

    await AccountsService.prototype.findAllClinicsAdmin.call(
      serviceContext,
      1,
      10,
      undefined,
      undefined,
      'Cardiology',
    );

    expect(serviceContext.accountRepository.findClinicsAdminWithFilters).toHaveBeenCalledWith(
      AccountRole.CLINIC_ADMIN,
      0,
      10,
      undefined,
      undefined,
      'Cardiology',
      false,
    );
  });

  it('UT-16-05: Bubble repository failure as internal server error.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsAdminWithFilters.mockRejectedValue(
      new Error('database read failed'),
    );

    await expect(
      AccountsService.prototype.findAllClinicsAdmin.call(serviceContext, 1, 10),
    ).rejects.toThrow('database read failed');
  });

  it('UT-16-06: Return empty list when no functional clinics exist.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsAdminWithFilters.mockResolvedValue([[], 0]);
    serviceContext.dataSource.query.mockResolvedValue([]);

    const result = await AccountsService.prototype.findAllClinicsAdmin.call(
      serviceContext,
      1,
      10,
    );

    expect(result).toEqual({
      clinics: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
  });

  it('UT-16-07: Return empty list when no clinic matches filters.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsAdminWithFilters.mockResolvedValue([[], 0]);
    serviceContext.dataSource.query.mockResolvedValue([]);

    const result = await AccountsService.prototype.findAllClinicsAdmin.call(
      serviceContext,
      1,
      10,
      'nonexistent_clinic_name',
      'invalid_province',
      'NonexistentSpecialty',
    );

    expect(result.clinics).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it('UT-16-08: Return empty page when page exceeds available data.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsAdminWithFilters.mockResolvedValue([[], 1]);
    serviceContext.dataSource.query.mockResolvedValue([]);

    const result = await AccountsService.prototype.findAllClinicsAdmin.call(
      serviceContext,
      999,
      10,
    );

    expect(result.pagination).toEqual({
      page: 999,
      limit: 10,
      total: 1,
      totalPages: 1,
    });
  });

  it('UT-16-09: Return one clinic when limit is 1.', async () => {
    const serviceContext = createServiceContext();
    serviceContext.accountRepository.findClinicsAdminWithFilters.mockResolvedValue([
      [createClinic()],
      3,
    ]);
    serviceContext.dataSource.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await AccountsService.prototype.findAllClinicsAdmin.call(
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
