import { Test, TestingModule } from '@nestjs/testing';
import { ClinicManagerService } from '../../../../src/modules/accounts/api-clinic-admin/clinic-manager.service';
import { AccountRepository } from '../../../../src/modules/accounts/repositories/account.repository';
import { ClinicManagerInformationRepository } from '../../../../src/modules/accounts/repositories/clinic-manager-information.repository';
import { AddressRepository } from '../../../../src/modules/accounts/repositories/address.repository';
import { GoogleIframeRepository } from '../../../../src/modules/accounts/repositories/google-iframe.repository';
import { ClinicsLegalDocumentsRepository } from '../../../../src/modules/accounts/repositories/clinics-legal-documents.repository';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AccountRole, AccountStatus } from '../../../../src/modules/accounts/enums';
import { Gender } from '../../../../src/modules/accounts/enums/gender.enum';
import { LegalDocumentVerificationStatus } from '../../../../src/modules/accounts/enums/legal-document-verification-status.enum';
import * as bcrypt from 'bcrypt';

describe('ClinicManagerService', () => {
  let service: ClinicManagerService;
  let accountRepository: any;
  let managerInfoRepository: any;
  let addressRepository: any;
  let googleIframeRepository: any;
  let legalDocsRepository: any;
  let dataSource: any;
  let queryRunner: any;

  // ============================================================================
  // MOCK DATA FACTORIES
  // ============================================================================
  const createMockAccount = (overrides = {}) => ({
    _id: 'account-123',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword',
    role: AccountRole.CLINIC_ADMIN,
    status: AccountStatus.ACTIVE,
    parentId: null,
    isEmailVerified: false,
    isOAuthUser: false,
    publicKey: 'mock-public-key',
    encryptedPrivateKey: 'mock-private-key',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  });

  const createMockManager = (overrides = {}) => ({
    _id: 'manager-123',
    username: 'manager',
    email: 'manager@clinic.com',
    password: 'hashedPassword',
    role: AccountRole.CLINIC_MANAGER,
    status: AccountStatus.ACTIVE,
    parentId: 'admin-123',
    isEmailVerified: false,
    isOAuthUser: false,
    publicKey: 'mock-public-key',
    encryptedPrivateKey: 'mock-private-key',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    children: [],
    ...overrides,
  });

  const createMockManagerInfo = (overrides = {}) => ({
    _id: 'manager-info-1',
    accountId: 'manager-123',
    fullName: 'Manager Name',
    clinicBranchName: 'Main Branch',
    gender: Gender.MALE,
    dob: new Date('1990-01-01'),
    profilePicture: null,
    createdAt: new Date('2026-01-01'),
    account: createMockManager(),
    address: null,
    legalDocuments: null,
    staffCount: 0,
    doctorCount: 0,
    ...overrides,
  });

  const createMockAddress = (overrides = {}) => ({
    _id: 'address-1',
    accountId: 'manager-123',
    address: '123 Main St',
    ward: 'ward-1',
    wardName: 'Ward 1',
    district: 'district-1',
    districtName: 'District 1',
    province: 'province-1',
    provinceName: 'Ho Chi Minh',
    ...overrides,
  });

  const createMockGoogleIframe = (overrides = {}) => ({
    _id: 'iframe-1',
    addressId: 'address-1',
    googleMapIframe: '<iframe src="..."></iframe>',
    responsive: true,
    ...overrides,
  });

  const createMockLegalDocs = (overrides = {}) => ({
    _id: 'legal-1',
    accountId: 'manager-123',
    operatingLicense: 'https://example.com/operating.pdf',
    businessLicense: 'https://example.com/business.pdf',
    taxIdUrl: 'https://example.com/tax.pdf',
    otherDocs: null,
    verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
    rejectionReason: null,
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  });

  const createMockStaff = (overrides = {}) => ({
    _id: 'staff-1',
    email: 'staff@clinic.com',
    role: AccountRole.CLINIC_STAFF,
    status: AccountStatus.ACTIVE,
    parentId: 'manager-123',
    deletedAt: null,
    clinicStaffInformation: {
      fullName: 'Staff Member',
      clinicRole: 'Receptionist',
    },
    ...overrides,
  });

  const createMockDoctor = (overrides = {}) => ({
    _id: 'doctor-1',
    email: 'doctor@clinic.com',
    role: AccountRole.DOCTOR,
    status: AccountStatus.ACTIVE,
    parentId: 'manager-123',
    deletedAt: null,
    doctorInformation: {
      fullName: 'Dr. John Doe',
      specialization: 'Cardiology',
    },
    ...overrides,
  });

  // ============================================================================
  // SETUP & TEARDOWN
  // ============================================================================
  beforeEach(async () => {
    // Mock QueryRunner
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
        update: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Mock DataSource
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    // Mock AccountRepository
    accountRepository = {
      findAccountById: jest.fn().mockResolvedValue(createMockAccount({ role: AccountRole.CLINIC_ADMIN })),
      findAccountByEmail: jest.fn().mockResolvedValue(null),
      createAccount: jest.fn().mockReturnValue(createMockManager()),
      saveAccount: jest.fn().mockResolvedValue(undefined),
      countPersonnelByManager: jest.fn().mockResolvedValue({ staffCount: 2, doctorCount: 1 }),
    };

    // Mock ClinicManagerInformationRepository
    managerInfoRepository = {
      findManagersByAdminWithPagination: jest.fn().mockResolvedValue([[], 0]),
      findManagerDetailById: jest.fn().mockResolvedValue(createMockManagerInfo()),
      create: jest.fn().mockReturnValue(createMockManagerInfo()),
      findByAccountId: jest.fn().mockResolvedValue(createMockManagerInfo()),
      save: jest.fn().mockResolvedValue(undefined),
    };

    // Mock AddressRepository
    addressRepository = {
      findByAccountId: jest.fn().mockResolvedValue(createMockAddress()),
      create: jest.fn().mockReturnValue(createMockAddress()),
      save: jest.fn().mockResolvedValue(undefined),
    };

    // Mock GoogleIframeRepository
    googleIframeRepository = {
      findByAddressId: jest.fn().mockResolvedValue(createMockGoogleIframe()),
      create: jest.fn().mockReturnValue(createMockGoogleIframe()),
      save: jest.fn().mockResolvedValue(undefined),
    };

    // Mock ClinicsLegalDocumentsRepository
    legalDocsRepository = {
      findByAccountId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue(createMockLegalDocs()),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicManagerService,
        { provide: AccountRepository, useValue: accountRepository },
        { provide: ClinicManagerInformationRepository, useValue: managerInfoRepository },
        { provide: AddressRepository, useValue: addressRepository },
        { provide: GoogleIframeRepository, useValue: googleIframeRepository },
        { provide: ClinicsLegalDocumentsRepository, useValue: legalDocsRepository },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<ClinicManagerService>(ClinicManagerService);

    // Mock bcrypt
    jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashedPassword'));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // SERVICE DEFINITION
  // ============================================================================
  describe('Service Definition', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  // ============================================================================
  // FLOW 1: GET MANAGER LIST
  // ============================================================================
  describe('getManagerList', () => {
    const adminId = 'admin-123';
    const defaultQuery = {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'DESC' as const,
    };

    it('should throw ForbiddenException if requester is not CLINIC_ADMIN', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockAccount({ role: AccountRole.PATIENT })
      );

      await expect(service.getManagerList(adminId, defaultQuery)).rejects.toThrow(ForbiddenException);
      await expect(service.getManagerList(adminId, defaultQuery)).rejects.toThrow(
        'Only clinic admins can view manager list'
      );
    });

    it('should throw ForbiddenException if admin account not found', async () => {
      accountRepository.findAccountById.mockResolvedValue(null);

      await expect(service.getManagerList(adminId, defaultQuery)).rejects.toThrow(ForbiddenException);
    });

    it('should return empty list when no managers exist', async () => {
      managerInfoRepository.findManagersByAdminWithPagination.mockResolvedValue([[], 0]);

      const result = await service.getManagerList(adminId, defaultQuery);

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 0,
        totalPages: 0,
      });
    });

    it('should return paginated manager list with correct mapping', async () => {
      const mockManagers = [
        createMockManagerInfo({
          account: createMockManager({ _id: 'mgr-1', email: 'mgr1@clinic.com', status: AccountStatus.ACTIVE }),
          fullName: 'Manager One',
          clinicBranchName: 'Branch A',
          staffCount: 3,
          doctorCount: 2,
          address: createMockAddress({ provinceName: 'Hanoi' }),
          legalDocuments: createMockLegalDocs({ verificationStatus: LegalDocumentVerificationStatus.APPROVED }),
        }),
        createMockManagerInfo({
          account: createMockManager({ _id: 'mgr-2', email: 'mgr2@clinic.com', status: AccountStatus.PENDING_APPROVAL }),
          fullName: 'Manager Two',
          clinicBranchName: 'Branch B',
          staffCount: 0,
          doctorCount: 0,
          address: null,
          legalDocuments: null,
        }),
      ];

      managerInfoRepository.findManagersByAdminWithPagination.mockResolvedValue([mockManagers, 2]);

      const result = await service.getManagerList(adminId, defaultQuery);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        managerId: 'mgr-1',
        fullName: 'Manager One',
        clinicBranchName: 'Branch A',
        email: 'mgr1@clinic.com',
        status: AccountStatus.ACTIVE,
        legalDocStatus: LegalDocumentVerificationStatus.APPROVED,
        staffCount: 3,
        doctorCount: 2,
        province: 'Hanoi',
      });
      expect(result.data[1]).toMatchObject({
        managerId: 'mgr-2',
        fullName: 'Manager Two',
        clinicBranchName: 'Branch B',
        status: AccountStatus.PENDING_APPROVAL,
        legalDocStatus: 'NOT_SUBMITTED',
        staffCount: 0,
        doctorCount: 0,
        province: 'N/A',
      });
      expect(result.meta.totalItems).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should calculate pagination correctly', async () => {
      const mockManagers = Array(25).fill(null).map((_, i) => 
        createMockManagerInfo({
          account: createMockManager({ _id: `mgr-${i}` }),
        })
      );

      managerInfoRepository.findManagersByAdminWithPagination.mockResolvedValue([
        mockManagers.slice(0, 10), 
        25
      ]);

      const result = await service.getManagerList(adminId, defaultQuery);

      expect(result.meta).toEqual({
        currentPage: 1,
        itemsPerPage: 10,
        totalItems: 25,
        totalPages: 3,
      });
    });

    it('should use default pagination parameters', async () => {
      managerInfoRepository.findManagersByAdminWithPagination.mockResolvedValue([[], 0]);

      await service.getManagerList(adminId, defaultQuery);

      expect(managerInfoRepository.findManagersByAdminWithPagination).toHaveBeenCalledWith(
        adminId,
        defaultQuery
      );
    });

    it('should respect custom pagination and sorting parameters', async () => {
      managerInfoRepository.findManagersByAdminWithPagination.mockResolvedValue([[], 0]);
      const customQuery = { page: 2, limit: 20, sortBy: 'fullName', sortOrder: 'ASC' as const };

      await service.getManagerList(adminId, customQuery);

      expect(managerInfoRepository.findManagersByAdminWithPagination).toHaveBeenCalledWith(
        adminId,
        customQuery
      );
    });

    // Filtering test cases
    it('should pass fullName filter to repository', async () => {
      managerInfoRepository.findManagersByAdminWithPagination.mockResolvedValue([[], 0]);
      const queryWithFilter = { ...defaultQuery, fullName: 'John' };

      await service.getManagerList(adminId, queryWithFilter);

      expect(managerInfoRepository.findManagersByAdminWithPagination).toHaveBeenCalledWith(
        adminId,
        queryWithFilter
      );
    });

    it('should pass clinicBranchName filter to repository', async () => {
      managerInfoRepository.findManagersByAdminWithPagination.mockResolvedValue([[], 0]);
      const queryWithFilter = { ...defaultQuery, clinicBranchName: 'Main Branch' };

      await service.getManagerList(adminId, queryWithFilter);

      expect(managerInfoRepository.findManagersByAdminWithPagination).toHaveBeenCalledWith(
        adminId,
        queryWithFilter
      );
    });

    it('should pass email filter to repository', async () => {
      managerInfoRepository.findManagersByAdminWithPagination.mockResolvedValue([[], 0]);
      const queryWithFilter = { ...defaultQuery, email: 'manager@clinic.com' };

      await service.getManagerList(adminId, queryWithFilter);

      expect(managerInfoRepository.findManagersByAdminWithPagination).toHaveBeenCalledWith(
        adminId,
        queryWithFilter
      );
    });

    it('should pass status filter to repository', async () => {
      managerInfoRepository.findManagersByAdminWithPagination.mockResolvedValue([[], 0]);
      const queryWithFilter = { ...defaultQuery, status: AccountStatus.ACTIVE };

      await service.getManagerList(adminId, queryWithFilter);

      expect(managerInfoRepository.findManagersByAdminWithPagination).toHaveBeenCalledWith(
        adminId,
        queryWithFilter
      );
    });

    it('should pass legalDocStatus filter to repository', async () => {
      managerInfoRepository.findManagersByAdminWithPagination.mockResolvedValue([[], 0]);
      const queryWithFilter = { ...defaultQuery, legalDocStatus: 'APPROVED' };

      await service.getManagerList(adminId, queryWithFilter);

      expect(managerInfoRepository.findManagersByAdminWithPagination).toHaveBeenCalledWith(
        adminId,
        queryWithFilter
      );
    });

    it('should pass province filter to repository', async () => {
      managerInfoRepository.findManagersByAdminWithPagination.mockResolvedValue([[], 0]);
      const queryWithFilter = { ...defaultQuery, province: 'Ho Chi Minh' };

      await service.getManagerList(adminId, queryWithFilter);

      expect(managerInfoRepository.findManagersByAdminWithPagination).toHaveBeenCalledWith(
        adminId,
        queryWithFilter
      );
    });

    it('should pass multiple filters to repository', async () => {
      managerInfoRepository.findManagersByAdminWithPagination.mockResolvedValue([[], 0]);
      const queryWithFilters = {
        ...defaultQuery,
        fullName: 'John',
        status: AccountStatus.ACTIVE,
        province: 'Hanoi',
      };

      await service.getManagerList(adminId, queryWithFilters);

      expect(managerInfoRepository.findManagersByAdminWithPagination).toHaveBeenCalledWith(
        adminId,
        queryWithFilters
      );
    });
  });

  // ============================================================================
  // FLOW 2: GET MANAGER DETAIL
  // ============================================================================
  describe('getManagerDetail', () => {
    const adminId = 'admin-123';
    const managerId = 'manager-123';

    it('should throw NotFoundException if manager not found', async () => {
      managerInfoRepository.findManagerDetailById.mockResolvedValue(null);

      await expect(service.getManagerDetail(adminId, AccountRole.CLINIC_ADMIN, managerId)).rejects.toThrow(NotFoundException);
      await expect(service.getManagerDetail(adminId, AccountRole.CLINIC_ADMIN, managerId)).rejects.toThrow('Manager not found');
    });

    it('should throw ForbiddenException if admin does not own manager', async () => {
      managerInfoRepository.findManagerDetailById.mockResolvedValue(
        createMockManagerInfo({
          account: createMockManager({ parentId: 'other-admin-123' }),
        })
      );

      await expect(service.getManagerDetail(adminId, AccountRole.CLINIC_ADMIN, managerId)).rejects.toThrow(ForbiddenException);
      await expect(service.getManagerDetail(adminId, AccountRole.CLINIC_ADMIN, managerId)).rejects.toThrow(
        'You do not have access to this manager'
      );
    });

    it('should return manager detail with all information', async () => {
      const mockAddress = createMockAddress();
      const mockGoogleIframe = createMockGoogleIframe();
      const mockLegalDocs = createMockLegalDocs();

      const mockManager = createMockManagerInfo({
        _id: 'manager-info-123',
        fullName: 'Manager Name',
        clinicBranchName: 'Main Branch',
        gender: Gender.MALE,
        dob: new Date('1990-01-01'),
        profilePicture: 'https://example.com/pic.jpg',
        account: {
          ...createMockManager({
            _id: managerId,
            parentId: adminId,
            email: 'manager@clinic.com',
            status: AccountStatus.ACTIVE,
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-15'),
            children: [createMockStaff(), createMockDoctor()],
          }),
          addresses: [{ ...mockAddress, googleIframe: mockGoogleIframe }],
          legalDocuments: mockLegalDocs,
        },
      });

      managerInfoRepository.findManagerDetailById.mockResolvedValue(mockManager);

      const result = await service.getManagerDetail(adminId, AccountRole.CLINIC_ADMIN, managerId);

      expect(result).toMatchObject({
        managerId: managerId,
        clinicAdminId: adminId,
        fullName: 'Manager Name',
        clinicBranchName: 'Main Branch',
        email: 'manager@clinic.com',
        status: AccountStatus.ACTIVE,
        gender: Gender.MALE,
      });
      expect(result.address).toMatchObject({
        address: '123 Main St',
        wardName: 'Ward 1',
        districtName: 'District 1',
        provinceName: 'Ho Chi Minh',
        googleMapIframe: '<iframe src="..."></iframe>',
      });
      expect(result.legalDocuments).toMatchObject({
        operatingLicense: 'https://example.com/operating.pdf',
        businessLicense: 'https://example.com/business.pdf',
        taxIdUrl: 'https://example.com/tax.pdf',
        verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
      });
      expect(result.personnel).toHaveLength(2);
    });

    it('should return empty personnel array if manager status is PENDING_APPROVAL', async () => {
      const mockManager = createMockManagerInfo({
        account: createMockManager({
          _id: managerId,
          parentId: adminId,
          status: AccountStatus.PENDING_APPROVAL,
          children: [createMockStaff(), createMockDoctor()],
        }),
      });

      managerInfoRepository.findManagerDetailById.mockResolvedValue(mockManager);

      const result = await service.getManagerDetail(adminId, AccountRole.CLINIC_ADMIN, managerId);

      expect(result.personnel).toEqual([]);
      expect(result.status).toBe(AccountStatus.PENDING_APPROVAL);
    });

    it('should show full personnel list if manager status is MANAGER_DISABLED', async () => {
      const mockManager = createMockManagerInfo({
        account: createMockManager({
          _id: managerId,
          parentId: adminId,
          status: AccountStatus.MANAGER_DISABLED,
          children: [createMockStaff(), createMockDoctor()],
        }),
      });

      managerInfoRepository.findManagerDetailById.mockResolvedValue(mockManager);

      const result = await service.getManagerDetail(adminId, AccountRole.CLINIC_ADMIN, managerId);

      expect(result.personnel).toHaveLength(2);
      expect(result.status).toBe(AccountStatus.MANAGER_DISABLED);
    });

    it('should filter out deleted personnel (soft deleted)', async () => {
      const mockManager = createMockManagerInfo({
        account: createMockManager({
          _id: managerId,
          parentId: adminId,
          status: AccountStatus.ACTIVE,
          children: [
            createMockStaff(),
            createMockStaff({ _id: 'staff-2', deletedAt: new Date() }),
            createMockDoctor(),
          ],
        }),
      });

      managerInfoRepository.findManagerDetailById.mockResolvedValue(mockManager);

      const result = await service.getManagerDetail(adminId, AccountRole.CLINIC_ADMIN, managerId);

      expect(result.personnel).toHaveLength(2);
      expect(result.personnel.find(p => p.accountId === 'staff-2')).toBeUndefined();
    });

    it('should handle missing address and iframe gracefully', async () => {
      const mockManager = createMockManagerInfo({
        account: createMockManager({ _id: managerId, parentId: adminId }),
      });

      managerInfoRepository.findManagerDetailById.mockResolvedValue(mockManager);
      addressRepository.findByAccountId.mockResolvedValue(null);

      const result = await service.getManagerDetail(adminId, AccountRole.CLINIC_ADMIN, managerId);

      expect(result.address).toEqual({
        address: '',
        wardName: '',
        districtName: '',
        provinceName: '',
        googleMapIframe: null,
      });
    });

    it('should handle missing legal documents gracefully', async () => {
      const mockManager = createMockManagerInfo({
        account: createMockManager({ _id: managerId, parentId: adminId }),
      });

      managerInfoRepository.findManagerDetailById.mockResolvedValue(mockManager);
      legalDocsRepository.findByAccountId.mockResolvedValue(null);

      const result = await service.getManagerDetail(adminId, AccountRole.CLINIC_ADMIN, managerId);

      expect(result.legalDocuments).toMatchObject({
        operatingLicense: undefined,
        businessLicense: undefined,
        taxIdUrl: undefined,
        verificationStatus: 'NOT_SUBMITTED',
        rejectionReason: undefined,
      });
    });
  });

  // ============================================================================
  // FLOW 3: CREATE MANAGER
  // ============================================================================
  describe('createManager', () => {
    const adminId = 'admin-123';
    const validDto = {
      email: 'newmanager@clinic.com',
      password: 'Manager123',
      fullName: 'New Manager',
      clinicBranchName: 'New Branch',
      gender: Gender.MALE,
      dob: '1990-01-01',
      address: '456 Side St',
      ward: 'ward-2',
      wardName: 'Ward 2',
      district: 'district-2',
      districtName: 'District 2',
      province: 'province-2',
      provinceName: 'Da Nang',
      googleMapIframe: '<iframe src="..."></iframe>',
    };

    it('should throw ForbiddenException if requester is not CLINIC_ADMIN', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockAccount({ role: AccountRole.PATIENT })
      );

      await expect(service.createManager(adminId, validDto)).rejects.toThrow(ForbiddenException);
      await expect(service.createManager(adminId, validDto)).rejects.toThrow(
        'Only clinic admins can create managers'
      );
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if admin account not found', async () => {
      accountRepository.findAccountById.mockResolvedValue(null);

      await expect(service.createManager(adminId, validDto)).rejects.toThrow(ForbiddenException);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      accountRepository.findAccountByEmail.mockResolvedValue(
        createMockAccount({ email: validDto.email })
      );

      await expect(service.createManager(adminId, validDto)).rejects.toThrow(ConflictException);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should successfully create manager with PENDING_APPROVAL status', async () => {
      accountRepository.findAccountByEmail.mockResolvedValue(null);
      queryRunner.manager.save
        .mockResolvedValueOnce({ ...createMockManager(), _id: 'new-manager-123' }) // Account - _id must come AFTER spread
        .mockResolvedValueOnce(createMockManagerInfo())  // ManagerInfo
        .mockResolvedValueOnce(createMockAddress())      // Address
        .mockResolvedValueOnce(createMockGoogleIframe()); // GoogleIframe

      const result = await service.createManager(adminId, validDto);

      // Assert transaction flow
      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();

      // Assert account creation
      expect(accountRepository.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validDto.email,
          password: 'hashedPassword',
          role: AccountRole.CLINIC_MANAGER,
          status: AccountStatus.PENDING_APPROVAL, // KEY: Should be PENDING_APPROVAL
          parentId: adminId,
          isEmailVerified: false,
        })
      );

      // Assert manager info creation
      expect(managerInfoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: validDto.fullName,
          clinicBranchName: validDto.clinicBranchName,
          gender: validDto.gender,
        })
      );

      // Assert address creation
      expect(addressRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          address: validDto.address,
          ward: validDto.ward,
          province: validDto.province,
        })
      );

      // Assert iframe creation
      expect(googleIframeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          googleMapIframe: validDto.googleMapIframe,
          responsive: true,
        })
      );

      // Assert result
      expect(result).toMatchObject({
        managerId: 'new-manager-123',
        message: expect.stringContaining('Manager account created successfully'),
      });
    });

    it('should create manager without googleMapIframe if not provided', async () => {
      const dtoWithoutIframe = { ...validDto };
      delete dtoWithoutIframe.googleMapIframe;

      accountRepository.findAccountByEmail.mockResolvedValue(null);
      queryRunner.manager.save
        .mockResolvedValueOnce({ _id: 'new-manager-123' })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await service.createManager(adminId, dtoWithoutIframe);

      expect(googleIframeRepository.create).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should hash password using bcrypt', async () => {
      accountRepository.findAccountByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockResolvedValue({ _id: 'new-manager-123' });

      await service.createManager(adminId, validDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(validDto.password, 10);
    });

    it('should rollback transaction on error', async () => {
      accountRepository.findAccountByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockRejectedValue(new Error('Database error'));

      await expect(service.createManager(adminId, validDto)).rejects.toThrow('Database error');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should parse dob string to Date object', async () => {
      accountRepository.findAccountByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockResolvedValue({ _id: 'new-manager-123' });

      await service.createManager(adminId, validDto);

      expect(managerInfoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          dob: new Date('1990-01-01'),
        })
      );
    });
  });

  // ============================================================================
  // FLOW 4: UPDATE LEGAL DOCUMENTS
  // ============================================================================
  describe('updateLegalDocuments', () => {
    const adminId = 'admin-123';
    const managerId = 'manager-123';
    const validDto = {
      operatingLicense: 'https://example.com/new-operating.pdf',
      businessLicense: 'https://example.com/new-business.pdf',
      taxIdUrl: 'https://example.com/new-tax.pdf',
      otherDocs: ['https://example.com/other.pdf'],
    };

    beforeEach(() => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ _id: managerId, parentId: adminId, role: AccountRole.CLINIC_MANAGER })
      );
    });

    it('should throw NotFoundException if manager not found', async () => {
      accountRepository.findAccountById.mockResolvedValue(null);

      await expect(service.updateLegalDocuments(adminId, managerId, validDto)).rejects.toThrow(
        NotFoundException
      );
      await expect(service.updateLegalDocuments(adminId, managerId, validDto)).rejects.toThrow(
        'Manager not found'
      );
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if admin does not own manager', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ parentId: 'other-admin-123' })
      );

      await expect(service.updateLegalDocuments(adminId, managerId, validDto)).rejects.toThrow(
        ForbiddenException
      );
      await expect(service.updateLegalDocuments(adminId, managerId, validDto)).rejects.toThrow(
        'You do not have access to this manager'
      );
    });

    it('should throw BadRequestException if account is not a manager', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockAccount({ _id: managerId, parentId: adminId, role: AccountRole.CLINIC_STAFF })
      );

      await expect(service.updateLegalDocuments(adminId, managerId, validDto)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.updateLegalDocuments(adminId, managerId, validDto)).rejects.toThrow(
        'Account is not a clinic manager'
      );
    });

    it('should create new legal documents if not exist and set status to PENDING_REVIEW', async () => {
      legalDocsRepository.findByAccountId.mockResolvedValue(null);

      await service.updateLegalDocuments(adminId, managerId, validDto);

      expect(legalDocsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: managerId,
          operatingLicense: validDto.operatingLicense,
          businessLicense: validDto.businessLicense,
          taxIdUrl: validDto.taxIdUrl,
          otherDocs: validDto.otherDocs,
          verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
        })
      );
      expect(queryRunner.manager.save).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should update existing legal documents and reset status to PENDING_REVIEW', async () => {
      const existingDocs = createMockLegalDocs({
        verificationStatus: LegalDocumentVerificationStatus.APPROVED,
        rejectionReason: 'Old rejection',
      });
      legalDocsRepository.findByAccountId.mockResolvedValue(existingDocs);

      await service.updateLegalDocuments(adminId, managerId, validDto);

      expect(existingDocs.verificationStatus).toBe(LegalDocumentVerificationStatus.PENDING_REVIEW);
      expect(existingDocs.rejectionReason).toBeNull();
      expect(existingDocs.operatingLicense).toBe(validDto.operatingLicense);
      expect(queryRunner.manager.save).toHaveBeenCalledWith(existingDocs);
    });

    it('should set manager status to PENDING_APPROVAL if not already', async () => {
      const manager = createMockManager({ 
        _id: managerId, 
        parentId: adminId,
        status: AccountStatus.ACTIVE 
      });
      accountRepository.findAccountById.mockResolvedValue(manager);
      legalDocsRepository.findByAccountId.mockResolvedValue(null);

      await service.updateLegalDocuments(adminId, managerId, validDto);

      expect(manager.status).toBe(AccountStatus.PENDING_APPROVAL);
      expect(queryRunner.manager.save).toHaveBeenCalledWith(manager);
    });

    it('should NOT change manager status if already PENDING_APPROVAL', async () => {
      const manager = createMockManager({ 
        _id: managerId, 
        parentId: adminId,
        status: AccountStatus.PENDING_APPROVAL 
      });
      accountRepository.findAccountById.mockResolvedValue(manager);
      legalDocsRepository.findByAccountId.mockResolvedValue(null);

      await service.updateLegalDocuments(adminId, managerId, validDto);

      expect(manager.status).toBe(AccountStatus.PENDING_APPROVAL);
    });

    it('should use transaction for atomic update', async () => {
      legalDocsRepository.findByAccountId.mockResolvedValue(null);

      await service.updateLegalDocuments(adminId, managerId, validDto);

      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      legalDocsRepository.findByAccountId.mockResolvedValue(null);
      queryRunner.manager.save.mockRejectedValue(new Error('Database error'));

      await expect(service.updateLegalDocuments(adminId, managerId, validDto)).rejects.toThrow(
        'Database error'
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('should preserve existing fields if not provided in dto', async () => {
      const existingDocs = createMockLegalDocs({
        operatingLicense: 'https://example.com/old-operating.pdf',
        businessLicense: 'https://example.com/old-business.pdf',
        taxIdUrl: 'https://example.com/old-tax.pdf',
      });
      legalDocsRepository.findByAccountId.mockResolvedValue(existingDocs);

      const partialDto = {
        operatingLicense: 'https://example.com/new-operating.pdf',
      };

      await service.updateLegalDocuments(adminId, managerId, partialDto as any);

      expect(existingDocs.operatingLicense).toBe(partialDto.operatingLicense);
      expect(existingDocs.businessLicense).toBe('https://example.com/old-business.pdf'); // Preserved
      expect(existingDocs.taxIdUrl).toBe('https://example.com/old-tax.pdf'); // Preserved
    });
  });

  // ============================================================================
  // FLOW 7: DISABLE MANAGER
  // ============================================================================
  describe('disableManager', () => {
    const adminId = 'admin-123';
    const managerId = 'manager-123';

    it('should throw NotFoundException if manager not found', async () => {
      accountRepository.findAccountById.mockResolvedValue(null);

      await expect(service.disableManager(adminId, managerId)).rejects.toThrow(NotFoundException);
      await expect(service.disableManager(adminId, managerId)).rejects.toThrow('Manager not found');
    });

    it('should throw ForbiddenException if admin does not own manager', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ parentId: 'other-admin-123' })
      );

      await expect(service.disableManager(adminId, managerId)).rejects.toThrow(ForbiddenException);
      await expect(service.disableManager(adminId, managerId)).rejects.toThrow(
        'You do not have access to this manager'
      );
    });

    it('should throw BadRequestException if account is not a manager', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockAccount({ _id: managerId, parentId: adminId, role: AccountRole.CLINIC_STAFF })
      );

      await expect(service.disableManager(adminId, managerId)).rejects.toThrow(BadRequestException);
      await expect(service.disableManager(adminId, managerId)).rejects.toThrow(
        'Account is not a clinic manager'
      );
    });

    it('should throw BadRequestException if manager status is not ACTIVE', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ status: AccountStatus.PENDING_APPROVAL })
      );

      await expect(service.disableManager(adminId, managerId)).rejects.toThrow(BadRequestException);
      await expect(service.disableManager(adminId, managerId)).rejects.toThrow(
        'Can only disable managers with ACTIVE status'
      );
    });

    it('should successfully disable ACTIVE manager', async () => {
      const manager = createMockManager({ 
        _id: managerId, 
        parentId: adminId,
        status: AccountStatus.ACTIVE 
      });
      accountRepository.findAccountById.mockResolvedValue(manager);
      accountRepository.countPersonnelByManager.mockResolvedValue({ staffCount: 5, doctorCount: 3 });

      const result = await service.disableManager(adminId, managerId);

      expect(manager.status).toBe(AccountStatus.MANAGER_DISABLED);
      expect(accountRepository.saveAccount).toHaveBeenCalledWith(manager);
      expect(accountRepository.countPersonnelByManager).toHaveBeenCalledWith(managerId);
      expect(result.message).toContain('Manager disabled successfully');
      expect(result.message).toContain('5 staff');
      expect(result.message).toContain('3 doctors');
    });

    it('should include personnel count in success message', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ status: AccountStatus.ACTIVE })
      );
      accountRepository.countPersonnelByManager.mockResolvedValue({ staffCount: 2, doctorCount: 1 });

      const result = await service.disableManager(adminId, managerId);

      expect(result.message).toBe(
        'Manager disabled successfully. 2 staff and 1 doctors will be unable to login until manager is re-enabled.'
      );
    });
  });

  // ============================================================================
  // FLOW 8: ENABLE MANAGER
  // ============================================================================
  describe('enableManager', () => {
    const adminId = 'admin-123';
    const managerId = 'manager-123';

    it('should throw NotFoundException if manager not found', async () => {
      accountRepository.findAccountById.mockResolvedValue(null);

      await expect(service.enableManager(adminId, managerId)).rejects.toThrow(NotFoundException);
      await expect(service.enableManager(adminId, managerId)).rejects.toThrow('Manager not found');
    });

    it('should throw ForbiddenException if admin does not own manager', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ parentId: 'other-admin-123' })
      );

      await expect(service.enableManager(adminId, managerId)).rejects.toThrow(ForbiddenException);
      await expect(service.enableManager(adminId, managerId)).rejects.toThrow(
        'You do not have access to this manager'
      );
    });

    it('should throw BadRequestException if account is not a manager', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockAccount({ _id: managerId, parentId: adminId, role: AccountRole.CLINIC_STAFF })
      );

      await expect(service.enableManager(adminId, managerId)).rejects.toThrow(BadRequestException);
      await expect(service.enableManager(adminId, managerId)).rejects.toThrow(
        'Account is not a clinic manager'
      );
    });

    it('should throw BadRequestException if manager status is not MANAGER_DISABLED', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ status: AccountStatus.ACTIVE })
      );

      await expect(service.enableManager(adminId, managerId)).rejects.toThrow(BadRequestException);
      await expect(service.enableManager(adminId, managerId)).rejects.toThrow(
        'Can only enable managers with MANAGER_DISABLED status'
      );
    });

    it('should successfully enable MANAGER_DISABLED manager', async () => {
      const manager = createMockManager({ 
        _id: managerId, 
        parentId: adminId,
        status: AccountStatus.MANAGER_DISABLED 
      });
      accountRepository.findAccountById.mockResolvedValue(manager);
      accountRepository.countPersonnelByManager.mockResolvedValue({ staffCount: 5, doctorCount: 3 });

      const result = await service.enableManager(adminId, managerId);

      expect(manager.status).toBe(AccountStatus.ACTIVE);
      expect(accountRepository.saveAccount).toHaveBeenCalledWith(manager);
      expect(accountRepository.countPersonnelByManager).toHaveBeenCalledWith(managerId);
      expect(result.message).toContain('Manager enabled successfully');
      expect(result.message).toContain('5 staff');
      expect(result.message).toContain('3 doctors');
    });

    it('should include personnel count in success message', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ status: AccountStatus.MANAGER_DISABLED })
      );
      accountRepository.countPersonnelByManager.mockResolvedValue({ staffCount: 2, doctorCount: 1 });

      const result = await service.enableManager(adminId, managerId);

      expect(result.message).toBe(
        'Manager enabled successfully. 2 staff and 1 doctors can now login to the system.'
      );
    });
  });

  // ============================================================================
  // FLOW 5: SOFT DELETE MANAGER
  // ============================================================================
  describe('softDeleteManager', () => {
    const adminId = 'admin-123';
    const managerId = 'manager-123';

    it('should throw NotFoundException if manager not found', async () => {
      accountRepository.findAccountById.mockResolvedValue(null);

      await expect(service.softDeleteManager(adminId, managerId)).rejects.toThrow(NotFoundException);
      await expect(service.softDeleteManager(adminId, managerId)).rejects.toThrow('Manager not found');
    });

    it('should throw ForbiddenException if admin does not own manager', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ parentId: 'other-admin-123' })
      );

      await expect(service.softDeleteManager(adminId, managerId)).rejects.toThrow(ForbiddenException);
      await expect(service.softDeleteManager(adminId, managerId)).rejects.toThrow(
        'You do not have access to this manager'
      );
    });

    it('should throw BadRequestException if legal documents are PENDING_REVIEW', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ status: AccountStatus.MANAGER_DISABLED })
      );
      legalDocsRepository.findByAccountId.mockResolvedValue(
        createMockLegalDocs({ verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW })
      );

      await expect(service.softDeleteManager(adminId, managerId)).rejects.toThrow(BadRequestException);
      await expect(service.softDeleteManager(adminId, managerId)).rejects.toThrow(
        'Cannot delete manager with legal documents pending review'
      );
    });

    it('should throw BadRequestException if manager status is ACTIVE', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ status: AccountStatus.ACTIVE })
      );
      legalDocsRepository.findByAccountId.mockResolvedValue(null);

      await expect(service.softDeleteManager(adminId, managerId)).rejects.toThrow(BadRequestException);
      await expect(service.softDeleteManager(adminId, managerId)).rejects.toThrow(
        'Cannot delete an ACTIVE manager. Please disable the manager first.'
      );
    });

    it('should successfully delete manager with PENDING_APPROVAL status', async () => {
      const manager = createMockManager({ 
        _id: managerId, 
        parentId: adminId,
        status: AccountStatus.PENDING_APPROVAL,
        deletedAt: null,
      });
      accountRepository.findAccountById.mockResolvedValue(manager);
      legalDocsRepository.findByAccountId.mockResolvedValue(null);

      const result = await service.softDeleteManager(adminId, managerId);

      expect(manager.deletedAt).toBeInstanceOf(Date);
      expect(accountRepository.saveAccount).toHaveBeenCalledWith(manager);
      expect(result.message).toBe('Manager account deleted successfully');
    });

    it('should successfully delete manager with MANAGER_DISABLED status', async () => {
      const manager = createMockManager({ 
        _id: managerId, 
        parentId: adminId,
        status: AccountStatus.MANAGER_DISABLED,
        deletedAt: null,
      });
      accountRepository.findAccountById.mockResolvedValue(manager);
      legalDocsRepository.findByAccountId.mockResolvedValue(null);

      const result = await service.softDeleteManager(adminId, managerId);

      expect(manager.deletedAt).toBeInstanceOf(Date);
      expect(accountRepository.saveAccount).toHaveBeenCalledWith(manager);
      expect(result.message).toBe('Manager account deleted successfully');
    });

    it('should successfully delete manager with BAN status', async () => {
      const manager = createMockManager({ 
        _id: managerId, 
        parentId: adminId,
        status: AccountStatus.BAN,
        deletedAt: null,
      });
      accountRepository.findAccountById.mockResolvedValue(manager);
      legalDocsRepository.findByAccountId.mockResolvedValue(null);

      const result = await service.softDeleteManager(adminId, managerId);

      expect(manager.deletedAt).toBeInstanceOf(Date);
      expect(accountRepository.saveAccount).toHaveBeenCalledWith(manager);
      expect(result.message).toBe('Manager account deleted successfully');
    });

    it('should allow deletion if legal documents are APPROVED', async () => {
      const manager = createMockManager({ 
        status: AccountStatus.MANAGER_DISABLED 
      });
      accountRepository.findAccountById.mockResolvedValue(manager);
      legalDocsRepository.findByAccountId.mockResolvedValue(
        createMockLegalDocs({ verificationStatus: LegalDocumentVerificationStatus.APPROVED })
      );

      const result = await service.softDeleteManager(adminId, managerId);

      expect(result.message).toBe('Manager account deleted successfully');
    });

    it('should allow deletion if legal documents are REJECTED', async () => {
      const manager = createMockManager({ 
        status: AccountStatus.MANAGER_DISABLED 
      });
      accountRepository.findAccountById.mockResolvedValue(manager);
      legalDocsRepository.findByAccountId.mockResolvedValue(
        createMockLegalDocs({ verificationStatus: LegalDocumentVerificationStatus.REJECTED })
      );

      const result = await service.softDeleteManager(adminId, managerId);

      expect(result.message).toBe('Manager account deleted successfully');
    });

    it('should allow deletion if no legal documents exist', async () => {
      const manager = createMockManager({ 
        status: AccountStatus.MANAGER_DISABLED 
      });
      accountRepository.findAccountById.mockResolvedValue(manager);
      legalDocsRepository.findByAccountId.mockResolvedValue(null);

      const result = await service.softDeleteManager(adminId, managerId);

      expect(result.message).toBe('Manager account deleted successfully');
    });
  });
});
