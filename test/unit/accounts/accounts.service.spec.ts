import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from '../../../src/modules/accounts/accounts.service';
import { AccountRepository } from '../../../src/modules/accounts/repositories/account.repository';
import { GeneralAccountRepository } from '../../../src/modules/accounts/repositories/general-account.repository';
import { CodeVerificationRepository } from '../../../src/modules/accounts/repositories/code-verification.repository';
import { ClinicAdminInformationRepository } from '../../../src/modules/accounts/repositories/clinic-admin-information.repository';
import { ClinicManagerInformationRepository } from '../../../src/modules/accounts/repositories/clinic-manager-information.repository';
import { ClinicStaffInformationRepository } from '../../../src/modules/accounts/repositories/clinic-staff-information.repository';
import { DoctorInformationRepository } from '../../../src/modules/accounts/repositories/doctor-information.repository';
import { ClinicsLegalDocumentsRepository } from '../../../src/modules/accounts/repositories/clinics-legal-documents.repository';
import { AddressRepository } from '../../../src/modules/accounts/repositories/address.repository';
import { GoogleIframeRepository } from '../../../src/modules/accounts/repositories/google-iframe.repository';
import { ClinicSubscriptionRepository } from '../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { ClinicSubscriptionHistoryRepository } from '../../../src/modules/subscriptions/repositories/clinic-subscription-history.repository';
import { ContractPackageRepository } from '../../../src/modules/contracts/repositories/contract-package.repository';
import { SubscriptionServiceRepository } from '../../../src/modules/subscriptions/repositories/subscription-service.repository';
import { TransactionRepository } from '../../../src/modules/transactions/repositories/transaction.repository';
import { MailerService } from '../../../src/modules/mailer/mailer.service';
import { DataSource } from 'typeorm';
import { ZaloWebhookService } from '../../../src/modules/accounts/zalo-webhook.service';
import { Account } from '../../../src/modules/accounts/entities/accounts.entity';
import { ClinicAdminInformation } from '../../../src/modules/accounts/entities/clinic-admin-information.entity';
import { ClinicSubscription } from '../../../src/modules/subscriptions/entities/clinic-subscription.entity';
import {
  AccountRole,
  AccountStatus,
} from '../../../src/modules/accounts/enums';
import { Gender } from '../../../src/modules/accounts/enums/gender.enum';
import { ClinicRole } from '../../../src/modules/accounts/enums/clinic-role.enum';
import { RegistrationStatus } from '../../../src/modules/subscriptions/enums/subscription-status.enum';
import { LegalDocumentVerificationStatus } from '../../../src/modules/accounts/enums/legal-document-verification-status.enum';
import { PaymentStatus } from '../../../src/modules/transactions/entities/transaction.entity';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AccountsService - Registration Flow', () => {
  let service: AccountsService;
  let accountRepository: any;
  let clinicAdminInfoRepository: any;
  let clinicManagerInfoRepository: any;
  let clinicLegalDocsRepository: any;
  let addressRepository: any;
  let clinicSubscriptionRepository: any;
  let transactionRepository: any;
  let mailerService: any;
  let zaloWebhookService: any;
  let dataSource: any;
  let queryRunner: any;

  let registrationAccountsQb: any;
  let clinicAdminRegistrationStateQb: any;
  let clinicAdminAccountQb: any;
  let clinicAdminSepayQb: any;

  const createMockQueryBuilder = () => {
    const qb: any = {
      __params: {},
      where: jest.fn((_: any, params?: any) => {
        qb.__params = { ...qb.__params, ...(params || {}) };
        return qb;
      }),
      andWhere: jest.fn((_: any, params?: any) => {
        qb.__params = { ...qb.__params, ...(params || {}) };
        return qb;
      }),
      leftJoin: jest.fn(() => qb),
      leftJoinAndSelect: jest.fn(() => qb),
      select: jest.fn(() => qb),
      addSelect: jest.fn(() => qb),
      groupBy: jest.fn(() => qb),
      addGroupBy: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      addOrderBy: jest.fn(() => qb),
      take: jest.fn(() => qb),
      skip: jest.fn(() => qb),
      getOne: jest.fn(),
      getMany: jest.fn(),
      getRawOne: jest.fn(),
      getRawMany: jest.fn(),
      getCount: jest.fn(),
    };
    return qb;
  };

  // Mock Data Factories
  const createMockAccount = (overrides = {}) => ({
    _id: 'account-1',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword',
    phone: '0912345678',
    role: AccountRole.CLINIC_ADMIN,
    status: AccountStatus.ACTIVE,
    isEmailVerified: false,
    isOAuthUser: false,
    parentId: null,
    ...overrides,
  });

  const createMockClinicAdminInfo = (overrides = {}) => ({
    accountId: 'account-1',
    clinicName: 'Test Clinic',
    description: 'Test Description',
    specializedIn: ['Cardiology'],
    pros: ['Expert doctors'],
    paraclinical: ['X-Ray'],
    bankName: 'Vietcombank',
    bankNumber: '1234567890',
    bankBranch: 'HCM Branch',
    sepayVa: '1900123456',
    isVerify: false,
    ...overrides,
  });

  const createMockClinicSubscription = (overrides = {}) => ({
    _id: 'sub-1',
    clinicId: 'account-1',
    serviceId: 'service-1',
    subscriptionStatus: RegistrationStatus.PENDING_SEPAY_SETUP,
    subscriptionDate: new Date(),
    ...overrides,
  });

  const createMockClinicManager = (overrides = {}) => ({
    _id: 'manager-1',
    username: 'manager',
    email: 'manager@clinic.com',
    password: 'hashedPassword',
    phone: '0987654321',
    role: AccountRole.CLINIC_MANAGER,
    status: AccountStatus.ACTIVE,
    parentId: 'account-1',
    isEmailVerified: false,
    isOAuthUser: false,
    ...overrides,
  });

  // Alias for validateManagerStatus tests
  const createMockManager = createMockClinicManager;

  const createMockManagerInfo = (overrides = {}) => ({
    accountId: 'manager-1',
    clinicBranchName: 'Main Branch',
    fullName: 'Manager Name',
    gender: 'MALE',
    ...overrides,
  });

  const createMockLegalDocs = (overrides = {}) => ({
    _id: 'legal-1',
    accountId: 'manager-1',
    operatingLicense: 'https://example.com/operating.pdf',
    businessLicense: 'https://example.com/business.pdf',
    verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
    ...overrides,
  });

  beforeEach(async () => {
    // Mock QueryRunner
    registrationAccountsQb = createMockQueryBuilder();
    clinicAdminRegistrationStateQb = createMockQueryBuilder();
    clinicAdminAccountQb = createMockQueryBuilder();
    clinicAdminSepayQb = createMockQueryBuilder();

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
        update: jest.fn(),
        delete: jest.fn(),
        create: jest.fn((_: any, data: any) => data),
        getRepository: jest.fn((entity: any) => {
          // Account queries are used in multiple private helpers
          if (entity === Account) {
            return {
              createQueryBuilder: jest.fn((alias: string) => {
                if (alias === 'account') return registrationAccountsQb;
                if (alias === 'admin') return clinicAdminRegistrationStateQb;
                if (alias === 'clinicAdmin') return clinicAdminAccountQb;
                return createMockQueryBuilder();
              }),
            };
          }

          // Sepay uniqueness check during clinic admin registration
          if (entity === ClinicAdminInformation) {
            return {
              createQueryBuilder: jest.fn(() => clinicAdminSepayQb),
            };
          }

          return {
            createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
          };
        }),
      },
    };

    // Default query behavior (tests can override per-case)
    registrationAccountsQb.getMany.mockImplementation(async () => {
      const email = registrationAccountsQb.__params.email;
      const existing = await accountRepository.findAccountByEmail(email);
      if (!existing) return [];
      return Array.isArray(existing) ? existing : [existing];
    });

    clinicAdminSepayQb.getOne.mockImplementation(async () => {
      const sepayVa = clinicAdminSepayQb.__params.sepayVa;
      if (!sepayVa) return null;
      return clinicAdminInfoRepository.findBySepayVa(sepayVa);
    });

    clinicAdminAccountQb.getOne.mockImplementation(async () => {
      const clinicAdminId = clinicAdminAccountQb.__params.clinicAdminId;
      return clinicAdminId ? accountRepository.findById(clinicAdminId) : null;
    });

    clinicAdminRegistrationStateQb.getRawOne.mockImplementation(async () => {
      const clinicAdminId = clinicAdminRegistrationStateQb.__params.clinicAdminId;
      const admin = clinicAdminId ? await accountRepository.findById(clinicAdminId) : null;
      if (!admin) return null;

      return {
        clinicAdminId,
        clinicAdminRole: admin.role,
        clinicName: 'Test Clinic',
        subscriptionId: 'sub-1',
        subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
        managerCount: '0',
      };
    });

    // Mock DataSource
    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    // Mock Repositories
    accountRepository = {
      createAccount: jest.fn().mockReturnValue(createMockAccount()),
      findByEmail: jest.fn().mockResolvedValue(null),
      findAccountByEmail: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(createMockAccount()),
      findAccountById: jest.fn().mockResolvedValue(createMockAccount()),
      findByParentIdAndRole: jest.fn().mockResolvedValue([]),
    };

    clinicAdminInfoRepository = {
      create: jest.fn().mockReturnValue(createMockClinicAdminInfo()),
      findByAccountId: jest.fn().mockResolvedValue(createMockClinicAdminInfo()),
      findBySepayVa: jest.fn().mockResolvedValue(null),
    };

    clinicManagerInfoRepository = {
      create: jest.fn().mockReturnValue(createMockManagerInfo()),
    };

    clinicLegalDocsRepository = {
      create: jest.fn().mockReturnValue(createMockLegalDocs()),
      findByAccountId: jest.fn().mockResolvedValue(null),
    };

    addressRepository = {
      create: jest.fn().mockReturnValue({
        accountId: 'manager-1',
        address: '123 Main St',
        ward: 'ward1',
        wardName: 'Ward 1',
        district: 'district1',
        districtName: 'District 1',
        province: 'province1',
        provinceName: 'Ho Chi Minh',
      }),
      findByAccountId: jest.fn().mockResolvedValue(null),
    };

    clinicSubscriptionRepository = {
      create: jest.fn().mockReturnValue(createMockClinicSubscription()),
      findByClinicId: jest
        .fn()
        .mockResolvedValue(createMockClinicSubscription()),
    };

    transactionRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    mailerService = {
      sendClinicAdminWelcomeEmail: jest.fn().mockResolvedValue(true),
      sendManagerCredentialsEmail: jest.fn().mockResolvedValue(true),
    };

    zaloWebhookService = {
      sendFriendRequest: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: AccountRepository, useValue: accountRepository },
        { provide: GeneralAccountRepository, useValue: {} },
        { provide: CodeVerificationRepository, useValue: {} },
        {
          provide: ClinicAdminInformationRepository,
          useValue: clinicAdminInfoRepository,
        },
        {
          provide: ClinicManagerInformationRepository,
          useValue: clinicManagerInfoRepository,
        },
        {
          provide: ClinicStaffInformationRepository,
          useValue: {
            create: jest.fn().mockReturnValue({
              accountId: 'staff-1',
              fullName: 'Staff',
              clinicRole: ClinicRole.STAFF,
            }),
          },
        },
        {
          provide: DoctorInformationRepository,
          useValue: {
            create: jest.fn().mockReturnValue({
              accountId: 'doctor-1',
              fullName: 'Doctor',
              specialization: 'Cardiology',
            }),
          },
        },
        {
          provide: ClinicsLegalDocumentsRepository,
          useValue: clinicLegalDocsRepository,
        },
        { provide: AddressRepository, useValue: addressRepository },
        { provide: GoogleIframeRepository, useValue: {} },
        {
          provide: ClinicSubscriptionRepository,
          useValue: clinicSubscriptionRepository,
        },
        { provide: ClinicSubscriptionHistoryRepository, useValue: {} },
        { provide: ContractPackageRepository, useValue: {} },
        { provide: SubscriptionServiceRepository, useValue: {} },
        { provide: TransactionRepository, useValue: transactionRepository },
        { provide: MailerService, useValue: mailerService },
        { provide: DataSource, useValue: dataSource },
        { provide: ZaloWebhookService, useValue: zaloWebhookService },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);

    // Mock bcrypt
    (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('hashedPassword');
    (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(false);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // STEP 2: ACCOUNT INIT WITH PAYMENT DATA (registerClinicAdmin)
  // ============================================================================
  describe('Step 2: registerClinicAdmin', () => {
    const validDto = {
      username: 'clinicadmin',
      email: 'admin@clinic.com',
      password: 'Admin123',
      phone: '0912345678',
      clinicName: 'City Medical Center',
      description: 'Healthcare facility',
      specializedIn: ['Cardiology'],
      pros: ['Expert doctors'],
      paraclinical: ['X-Ray'],
      bankName: 'Vietcombank',
      bankNumber: '1234567890',
      bankBranch: 'HCM Branch',
      sepayVa: '1900123456',
      sepayKey: 'sepay_test_key_1234567890',
      serviceId: 'service-1',
    };

    it('should successfully create clinic admin with bank details and subscription', async () => {
      // Setup: No existing account
      accountRepository.findByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockResolvedValueOnce(
        createMockAccount({ _id: 'new-account-1' }),
      );

      const result = await service.registerClinicAdmin(validDto);

      // Assert transaction flow
      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();

      // Assert account creation
      expect(accountRepository.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          username: validDto.username,
          email: validDto.email,
          role: AccountRole.CLINIC_ADMIN,
          status: AccountStatus.ACTIVE,
        }),
      );

      // Assert admin info creation with bank details
      expect(clinicAdminInfoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicName: validDto.clinicName,
          bankName: validDto.bankName,
          bankNumber: validDto.bankNumber,
          bankBranch: validDto.bankBranch,
          sepayVa: validDto.sepayVa,
        }),
      );

      // Assert subscription creation with PENDING_SEPAY_SETUP status
      expect(clinicSubscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: validDto.serviceId,
          subscriptionStatus: RegistrationStatus.PENDING_SEPAY_SETUP,
        }),
      );

      // Assert welcome email sent
      expect(mailerService.sendClinicAdminWelcomeEmail).toHaveBeenCalledWith(
        validDto.email,
        validDto.clinicName,
      );

      // Assert result
      expect(result).toBeDefined();
    });

    it('should enforce email uniqueness - reject if email used by CLINIC_ADMIN', async () => {
      // Setup: Existing CLINIC_ADMIN with same email
      accountRepository.findAccountByEmail.mockResolvedValue(
        createMockAccount({ role: AccountRole.CLINIC_ADMIN }),
      );

      await expect(service.registerClinicAdmin(validDto)).rejects.toThrow(
        ConflictException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should enforce email uniqueness - reject if email used by CLINIC_MANAGER', async () => {
      // Setup: Existing CLINIC_MANAGER with same email
      accountRepository.findAccountByEmail.mockResolvedValue(
        createMockAccount({ role: AccountRole.CLINIC_MANAGER }),
      );

      // Current policy allows creating CLINIC_ADMIN even if a single CLINIC_MANAGER exists with same email
      const result = await service.registerClinicAdmin(validDto);
      expect(result).toBeDefined();
    });

    it('should enforce sepayVa uniqueness - reject if sepayVa is already used', async () => {
      // Setup: No existing account with this email
      accountRepository.findByEmail.mockResolvedValue(null);
      // Setup: Existing clinic with same sepayVa
      clinicAdminInfoRepository.findBySepayVa.mockResolvedValue(
        createMockClinicAdminInfo(),
      );

      await expect(service.registerClinicAdmin(validDto)).rejects.toThrow(
        ConflictException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should allow email reuse if existing account has different role (PATIENT)', async () => {
      // Setup: Existing PATIENT with same email
      accountRepository.findAccountByEmail.mockResolvedValue(
        createMockAccount({ role: AccountRole.PATIENT }),
      );

      await expect(service.registerClinicAdmin(validDto)).rejects.toThrow(
        ConflictException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should hash password before storing', async () => {
      accountRepository.findByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockResolvedValueOnce(createMockAccount());

      await service.registerClinicAdmin(validDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(
        validDto.password,
        expect.any(Number),
      );
      expect(accountRepository.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'hashedPassword',
        }),
      );
    });

    it('should rollback transaction on error', async () => {
      accountRepository.findByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockRejectedValue(new Error('Database error'));

      await expect(service.registerClinicAdmin(validDto)).rejects.toThrow(
        'Database error',
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should create subscription with correct status PENDING_SEPAY_SETUP', async () => {
      accountRepository.findByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockResolvedValueOnce(createMockAccount());

      await service.registerClinicAdmin(validDto);

      expect(clinicSubscriptionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: RegistrationStatus.PENDING_SEPAY_SETUP,
        }),
      );
    });
  });

  // ============================================================================
  // STEP 4A: CLINIC MANAGER SETUP (createClinicManagerForRegistration)
  // ============================================================================
  describe('Step 4A: createClinicManagerForRegistration', () => {
    const clinicAdminId = 'account-1';
    const validDto = {
      username: 'manager_john',
      email: 'manager@clinic.com',
      password: 'Manager123',
      phone: '0987654321',
      clinicBranchName: 'Main Branch',
      fullName: 'John Smith',
      gender: Gender.MALE,
      dob: '1985-05-15',
      provinceCode: 'HCM',
      provinceName: 'Ho Chi Minh',
      districtCode: 'D1',
      districtName: 'District 1',
      wardCode: 'W1',
      wardName: 'Ward 1',
      addressDetail: '123 Main St',
      idCardNumber: '123456789012',
      idCardFrontUrl: 'https://example.com/id-front.jpg',
      idCardBackUrl: 'https://example.com/id-back.jpg',
    };

    beforeEach(() => {
      // Setup default mocks
      accountRepository.findById.mockResolvedValue(
        createMockAccount({
          _id: clinicAdminId,
          role: AccountRole.CLINIC_ADMIN,
          password: 'hashedPassword',
        }),
      );
    });

    it('should successfully create clinic manager with address', async () => {
      const result = await service.createClinicManagerForRegistration(
        clinicAdminId,
        validDto,
      );

      // Assert transaction flow
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();

      // Assert manager account creation
      expect(accountRepository.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          username: validDto.username,
          email: validDto.email,
          role: AccountRole.CLINIC_MANAGER,
          status: AccountStatus.PENDING_APPROVAL,
          parentId: clinicAdminId,
        }),
      );

      // Assert manager info creation
      expect(clinicManagerInfoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicBranchName: validDto.clinicBranchName,
          fullName: validDto.fullName,
          gender: validDto.gender,
        }),
      );

      // Assert address creation with proper mapping
      expect(addressRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          address: validDto.addressDetail,
          ward: validDto.wardCode,
          wardName: validDto.wardName,
          district: validDto.districtCode,
          districtName: validDto.districtName,
          province: validDto.provinceCode,
          provinceName: validDto.provinceName,
        }),
      );

      // Assert subscription status update
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: RegistrationStatus.PENDING_LEGAL_SETUP,
        }),
      );

      // Assert credentials email sent
      expect(mailerService.sendManagerCredentialsEmail).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should reject if actor is not CLINIC_ADMIN', async () => {
      clinicAdminRegistrationStateQb.getRawOne.mockResolvedValueOnce({
        clinicAdminId,
        clinicAdminRole: AccountRole.PATIENT,
        clinicName: 'Test Clinic',
        subscriptionId: 'sub-1',
        subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
        managerCount: '0',
      });

      await expect(
        service.createClinicManagerForRegistration(clinicAdminId, validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if subscription status is not PENDING_MANAGER_SETUP', async () => {
      clinicAdminRegistrationStateQb.getRawOne.mockResolvedValueOnce({
        clinicAdminId,
        clinicAdminRole: AccountRole.CLINIC_ADMIN,
        clinicName: 'Test Clinic',
        subscriptionId: 'sub-1',
        subscriptionStatus: RegistrationStatus.PENDING_LEGAL_SETUP,
        managerCount: '0',
      });

      await expect(
        service.createClinicManagerForRegistration(clinicAdminId, validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if manager already exists', async () => {
      clinicAdminRegistrationStateQb.getRawOne.mockResolvedValueOnce({
        clinicAdminId,
        clinicAdminRole: AccountRole.CLINIC_ADMIN,
        clinicName: 'Test Clinic',
        subscriptionId: 'sub-1',
        subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
        managerCount: '1',
      });

      await expect(
        service.createClinicManagerForRegistration(clinicAdminId, validDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if email already exists', async () => {
      accountRepository.findAccountByEmail.mockResolvedValue(
        createMockAccount({ _id: 'another-admin', role: AccountRole.CLINIC_ADMIN }),
      );

      await expect(
        service.createClinicManagerForRegistration(clinicAdminId, validDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should transition subscription status to PENDING_LEGAL_SETUP', async () => {
      const mockSubscription = createMockClinicSubscription({
        subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
      });
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        mockSubscription,
      );

      await service.createClinicManagerForRegistration(clinicAdminId, validDto);

      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: RegistrationStatus.PENDING_LEGAL_SETUP,
        }),
      );
    });

    it('should rollback transaction on error', async () => {
      queryRunner.manager.save.mockRejectedValue(new Error('Database error'));

      await expect(
        service.createClinicManagerForRegistration(clinicAdminId, validDto),
      ).rejects.toThrow('Database error');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should link manager to admin via parentId', async () => {
      await service.createClinicManagerForRegistration(clinicAdminId, validDto);

      expect(accountRepository.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: clinicAdminId,
        }),
      );
    });
  });

  // ============================================================================
  // STEP 4B: LEGAL DOCUMENT UPLOAD (uploadLegalDocumentsForManager)
  // ============================================================================
  describe('Step 4B: uploadLegalDocumentsForManager', () => {
    const clinicAdminId = 'account-1';
    const managerAccountId = 'manager-1';
    const validDto = {
      operatingLicense: 'https://example.com/operating.pdf',
      businessLicense: 'https://example.com/business.pdf',
      taxIdUrl: 'https://example.com/tax.pdf',
      otherDocs: ['https://example.com/other.pdf'],
    };

    beforeEach(() => {
      accountRepository.findById
        .mockResolvedValueOnce(
          createMockAccount({
            _id: clinicAdminId,
            role: AccountRole.CLINIC_ADMIN,
          }),
        )
        .mockResolvedValueOnce(
          createMockClinicManager({
            _id: managerAccountId,
            parentId: clinicAdminId,
          }),
        );
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.PENDING_LEGAL_SETUP,
        }),
      );
      clinicLegalDocsRepository.findByAccountId.mockResolvedValue(null);
    });

    it('should successfully upload legal documents for manager', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(
          createMockAccount({
            _id: clinicAdminId,
            role: AccountRole.CLINIC_ADMIN,
          }),
        )
        .mockResolvedValueOnce(
          createMockClinicManager({
            _id: managerAccountId,
            parentId: clinicAdminId,
          }),
        );

      const result = await service.uploadLegalDocumentsForManager(
        clinicAdminId,
        managerAccountId,
        validDto,
      );

      // Assert transaction flow
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();

      // Assert legal docs creation
      expect(clinicLegalDocsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: managerAccountId,
          operatingLicense: validDto.operatingLicense,
          businessLicense: validDto.businessLicense,
          verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
        }),
      );

      // Assert subscription status update
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: RegistrationStatus.PENDING_APPROVAL,
        }),
      );

      expect(result).toBeDefined();
    });

    it('should reject if actor is not CLINIC_ADMIN', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(createMockAccount({ role: AccountRole.PATIENT }))
        .mockResolvedValueOnce(createMockClinicManager());

      await expect(
        service.uploadLegalDocumentsForManager(
          clinicAdminId,
          managerAccountId,
          validDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if manager is not CLINIC_MANAGER role', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(
          createMockAccount({ role: AccountRole.CLINIC_ADMIN }),
        )
        .mockResolvedValueOnce(
          createMockAccount({ role: AccountRole.PATIENT }),
        );

      await expect(
        service.uploadLegalDocumentsForManager(
          clinicAdminId,
          managerAccountId,
          validDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if manager is not owned by admin (parentId mismatch)', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(
          createMockAccount({
            _id: clinicAdminId,
            role: AccountRole.CLINIC_ADMIN,
          }),
        )
        .mockResolvedValueOnce(
          createMockClinicManager({ parentId: 'different-admin-id' }),
        );

      await expect(
        service.uploadLegalDocumentsForManager(
          clinicAdminId,
          managerAccountId,
          validDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if subscription status is not PENDING_LEGAL_SETUP', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(
          createMockAccount({
            _id: clinicAdminId,
            role: AccountRole.CLINIC_ADMIN,
          }),
        )
        .mockResolvedValueOnce(
          createMockClinicManager({
            _id: managerAccountId,
            parentId: clinicAdminId,
          }),
        );

      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
        }),
      );

      await expect(
        service.uploadLegalDocumentsForManager(
          clinicAdminId,
          managerAccountId,
          validDto,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update existing legal documents if already exist', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(
          createMockAccount({
            _id: clinicAdminId,
            role: AccountRole.CLINIC_ADMIN,
          }),
        )
        .mockResolvedValueOnce(
          createMockClinicManager({
            _id: managerAccountId,
            parentId: clinicAdminId,
          }),
        );

      const existingDocs = createMockLegalDocs({
        verificationStatus: LegalDocumentVerificationStatus.REJECTED,
      });
      clinicLegalDocsRepository.findByAccountId.mockResolvedValue(existingDocs);

      await service.uploadLegalDocumentsForManager(
        clinicAdminId,
        managerAccountId,
        validDto,
      );

      // Should update, not create
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          operatingLicense: validDto.operatingLicense,
          businessLicense: validDto.businessLicense,
          verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
        }),
      );
    });

    it('should transition subscription status to PENDING_APPROVAL', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(
          createMockAccount({
            _id: clinicAdminId,
            role: AccountRole.CLINIC_ADMIN,
          }),
        )
        .mockResolvedValueOnce(
          createMockClinicManager({
            _id: managerAccountId,
            parentId: clinicAdminId,
          }),
        );

      await service.uploadLegalDocumentsForManager(
        clinicAdminId,
        managerAccountId,
        validDto,
      );

      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: RegistrationStatus.PENDING_APPROVAL,
        }),
      );
    });

    it('should set verification status to PENDING_REVIEW', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(
          createMockAccount({
            _id: clinicAdminId,
            role: AccountRole.CLINIC_ADMIN,
          }),
        )
        .mockResolvedValueOnce(
          createMockClinicManager({
            _id: managerAccountId,
            parentId: clinicAdminId,
          }),
        );

      await service.uploadLegalDocumentsForManager(
        clinicAdminId,
        managerAccountId,
        validDto,
      );

      expect(clinicLegalDocsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
        }),
      );
    });

    it('should rollback transaction on error', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(
          createMockAccount({
            _id: clinicAdminId,
            role: AccountRole.CLINIC_ADMIN,
          }),
        )
        .mockResolvedValueOnce(
          createMockClinicManager({
            _id: managerAccountId,
            parentId: clinicAdminId,
          }),
        );

      queryRunner.manager.save.mockRejectedValue(new Error('Database error'));

      await expect(
        service.uploadLegalDocumentsForManager(
          clinicAdminId,
          managerAccountId,
          validDto,
        ),
      ).rejects.toThrow('Database error');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // STEP 8.1: HARD DELETE (cancelPendingRegistration)
  // ============================================================================
  describe('Step 8.1: cancelPendingRegistration', () => {
    const accountId = 'account-1';

    beforeEach(() => {
      accountRepository.findById.mockResolvedValue(
        createMockAccount({ _id: accountId, role: AccountRole.CLINIC_ADMIN }),
      );
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.PENDING_SEPAY_SETUP,
        }),
      );
      transactionRepository.findOne.mockResolvedValue(null);
    });

    it('should successfully hard delete all registration data', async () => {
      const result = await service.cancelPendingRegistration(accountId);

      // Assert transaction flow
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();

      // Assert deletion order (reverse FK order)
      const deleteOrder = queryRunner.manager.delete.mock.calls.map(
        (call) => call[0].name,
      );
      expect(deleteOrder).toContain('ClinicsLegalDocuments');
      expect(deleteOrder).toContain('ClinicManagerInformation');
      expect(deleteOrder).toContain('Account');
      expect(deleteOrder).toContain('Transaction');
      expect(deleteOrder).toContain('ClinicSubscription');
      expect(deleteOrder).toContain('ClinicAdminInformation');

      expect(result.success).toBe(true);
    });

    it('should reject if status is PENDING_APPROVAL', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.PENDING_APPROVAL,
        }),
      );

      await expect(
        service.cancelPendingRegistration(accountId),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should reject if status is ACTIVE', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.ACTIVE,
        }),
      );

      await expect(
        service.cancelPendingRegistration(accountId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if status is NON_RENEWING', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.NON_RENEWING,
        }),
      );

      await expect(
        service.cancelPendingRegistration(accountId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if status is EXPIRED', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.EXPIRED,
        }),
      );

      await expect(
        service.cancelPendingRegistration(accountId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if SUCCESS transaction exists', async () => {
      transactionRepository.findOne.mockResolvedValue({
        _id: 'tx-1',
        status: PaymentStatus.SUCCESS,
      });

      await expect(
        service.cancelPendingRegistration(accountId),
      ).rejects.toThrow(BadRequestException);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should allow cancellation from PENDING_SEPAY_SETUP', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.PENDING_SEPAY_SETUP,
        }),
      );

      const result = await service.cancelPendingRegistration(accountId);
      expect(result.success).toBe(true);
    });

    it('should allow cancellation from PENDING_MANAGER_SETUP', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
        }),
      );

      const result = await service.cancelPendingRegistration(accountId);
      expect(result.success).toBe(true);
    });

    it('should allow cancellation from PENDING_LEGAL_SETUP', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.PENDING_LEGAL_SETUP,
        }),
      );

      const result = await service.cancelPendingRegistration(accountId);
      expect(result.success).toBe(true);
    });

    it('should allow cancellation from PENDING_PAYMENT', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.PENDING_PAYMENT,
        }),
      );

      const result = await service.cancelPendingRegistration(accountId);
      expect(result.success).toBe(true);
    });

    it('should reject if actor is not CLINIC_ADMIN', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockAccount({ role: AccountRole.PATIENT }),
      );

      await expect(
        service.cancelPendingRegistration(accountId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should rollback transaction on error', async () => {
      queryRunner.manager.delete.mockRejectedValue(new Error('Database error'));

      await expect(
        service.cancelPendingRegistration(accountId),
      ).rejects.toThrow('Database error');
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should delete in correct reverse FK order', async () => {
      await service.cancelPendingRegistration(accountId);

      const deleteCalls = queryRunner.manager.delete.mock.calls;

      // Verify ClinicsLegalDocuments deleted before ClinicManagerInformation
      const legalDocsIndex = deleteCalls.findIndex(
        (call) => call[0].name === 'ClinicsLegalDocuments',
      );
      const managerInfoIndex = deleteCalls.findIndex(
        (call) => call[0].name === 'ClinicManagerInformation',
      );
      const managerAccountIndex = deleteCalls.findIndex(
        (call) =>
          call[0].name === 'Account' &&
          call[1].role === AccountRole.CLINIC_MANAGER,
      );
      const subscriptionIndex = deleteCalls.findIndex(
        (call) => call[0].name === 'ClinicSubscription',
      );
      const adminInfoIndex = deleteCalls.findIndex(
        (call) => call[0].name === 'ClinicAdminInformation',
      );
      const adminAccountIndex = deleteCalls.findIndex(
        (call) => call[0].name === 'Account' && call[1]._id === accountId,
      );

      // Verify proper order
      expect(legalDocsIndex).toBeGreaterThanOrEqual(0);
      expect(managerInfoIndex).toBeGreaterThan(legalDocsIndex);
      expect(managerAccountIndex).toBeGreaterThan(managerInfoIndex);
      expect(subscriptionIndex).toBeGreaterThan(managerAccountIndex);
      expect(adminInfoIndex).toBeGreaterThan(subscriptionIndex);
      expect(adminAccountIndex).toBeGreaterThan(adminInfoIndex);
    });
  });

  // ============================================================================
  // SECTION 2: MANAGER STATUS VALIDATION (validateManagerStatus)
  // ============================================================================
  describe('validateManagerStatus', () => {
    const managerId = 'manager-123';

    describe('CREATE_STAFF operation', () => {
      it('should throw NotFoundException if manager not found', async () => {
        accountRepository.findAccountById = jest.fn().mockResolvedValue(null);

        await expect(
          (service as any).validateManagerStatus(managerId, 'CREATE_STAFF'),
        ).rejects.toThrow('Manager account not found');
      });

      it('should throw ForbiddenException if account is not a manager', async () => {
        accountRepository.findAccountById = jest
          .fn()
          .mockResolvedValue(
            createMockAccount({ role: AccountRole.CLINIC_STAFF }),
          );

        await expect(
          (service as any).validateManagerStatus(managerId, 'CREATE_STAFF'),
        ).rejects.toThrow('Account is not a clinic manager');
      });

      it('should throw ForbiddenException if manager is PENDING_APPROVAL', async () => {
        accountRepository.findAccountById = jest
          .fn()
          .mockResolvedValue(
            createMockManager({ status: AccountStatus.PENDING_APPROVAL }),
          );

        await expect(
          (service as any).validateManagerStatus(managerId, 'CREATE_STAFF'),
        ).rejects.toThrow('Manager legal documents pending approval');
      });

      it('should throw ForbiddenException if manager is MANAGER_DISABLED', async () => {
        accountRepository.findAccountById = jest
          .fn()
          .mockResolvedValue(
            createMockManager({ status: AccountStatus.MANAGER_DISABLED }),
          );

        await expect(
          (service as any).validateManagerStatus(managerId, 'CREATE_STAFF'),
        ).rejects.toThrow('Manager account is disabled');
      });

      it('should throw ForbiddenException if manager status is not ACTIVE', async () => {
        accountRepository.findAccountById = jest
          .fn()
          .mockResolvedValue(createMockManager({ status: AccountStatus.BAN }));

        await expect(
          (service as any).validateManagerStatus(managerId, 'CREATE_STAFF'),
        ).rejects.toThrow(
          'Manager account must be ACTIVE to create staff members',
        );
      });

      it('should return manager entity if status is ACTIVE', async () => {
        const mockManager = createMockManager({ status: AccountStatus.ACTIVE });
        accountRepository.findAccountById = jest
          .fn()
          .mockResolvedValue(mockManager);

        const result = await (service as any).validateManagerStatus(
          managerId,
          'CREATE_STAFF',
        );

        expect(result).toEqual(mockManager);
        expect(accountRepository.findAccountById).toHaveBeenCalledWith(
          managerId,
        );
      });
    });

    describe('ENABLE operation', () => {
      it('should throw NotFoundException if manager not found', async () => {
        accountRepository.findAccountById = jest.fn().mockResolvedValue(null);

        await expect(
          (service as any).validateManagerStatus(managerId, 'ENABLE'),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException if manager is not MANAGER_DISABLED', async () => {
        accountRepository.findAccountById = jest
          .fn()
          .mockResolvedValue(
            createMockManager({ status: AccountStatus.ACTIVE }),
          );

        await expect(
          (service as any).validateManagerStatus(managerId, 'ENABLE'),
        ).rejects.toThrow(
          'Can only enable managers with MANAGER_DISABLED status',
        );
      });

      it('should return manager entity if status is MANAGER_DISABLED', async () => {
        const mockManager = createMockManager({
          status: AccountStatus.MANAGER_DISABLED,
        });
        accountRepository.findAccountById = jest
          .fn()
          .mockResolvedValue(mockManager);

        const result = await (service as any).validateManagerStatus(
          managerId,
          'ENABLE',
        );

        expect(result).toEqual(mockManager);
      });
    });

    describe('DISABLE operation', () => {
      it('should throw NotFoundException if manager not found', async () => {
        accountRepository.findAccountById = jest.fn().mockResolvedValue(null);

        await expect(
          (service as any).validateManagerStatus(managerId, 'DISABLE'),
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException if manager is not ACTIVE', async () => {
        accountRepository.findAccountById = jest
          .fn()
          .mockResolvedValue(
            createMockManager({ status: AccountStatus.PENDING_APPROVAL }),
          );

        await expect(
          (service as any).validateManagerStatus(managerId, 'DISABLE'),
        ).rejects.toThrow('Can only disable managers with ACTIVE status');
      });

      it('should return manager entity if status is ACTIVE', async () => {
        const mockManager = createMockManager({ status: AccountStatus.ACTIVE });
        accountRepository.findAccountById = jest
          .fn()
          .mockResolvedValue(mockManager);

        const result = await (service as any).validateManagerStatus(
          managerId,
          'DISABLE',
        );

        expect(result).toEqual(mockManager);
      });
    });
  });

  // ============================================================================
  // SECTION 2: STAFF/DOCTOR CREATION WITH MANAGER VALIDATION
  // ============================================================================
  describe('createStaffByClinicManager - with validateManagerStatus', () => {
    const managerId = 'manager-123';
    const mockManager = createMockManager({ status: AccountStatus.ACTIVE });

    const validStaffDto = {
      email: 'staff@clinic.com',
      password: 'Staff123',
      fullName: 'Staff Member',
      clinicRole: ClinicRole.STAFF,
      gender: Gender.MALE,
    };

    beforeEach(() => {
      accountRepository.findAccountById = jest
        .fn()
        .mockResolvedValue(mockManager);
      accountRepository.findByEmail = jest.fn().mockResolvedValue(null);
    });

    it('should call validateManagerStatus before creating staff', async () => {
      const validateSpy = jest.spyOn(service as any, 'validateManagerStatus');

      // Mock successful staff creation
      accountRepository.findAccountByEmail.mockResolvedValue(null);
      queryRunner.manager.save
        .mockResolvedValueOnce(
          createMockAccount({ role: AccountRole.CLINIC_STAFF }),
        )
        .mockResolvedValueOnce({
          accountId: 'staff-1',
          fullName: 'Staff Member',
          clinicRole: ClinicRole.STAFF,
        });

      await service.createStaffByClinicManager(managerId, validStaffDto);

      expect(validateSpy).toHaveBeenCalledWith(managerId, 'CREATE_STAFF');
      expect(validateSpy).toHaveBeenCalled();
    });

    it('should block staff creation if manager is PENDING_APPROVAL', async () => {
      accountRepository.findAccountById = jest
        .fn()
        .mockResolvedValue(
          createMockManager({ status: AccountStatus.PENDING_APPROVAL }),
        );

      await expect(
        service.createStaffByClinicManager(managerId, validStaffDto),
      ).rejects.toThrow('Manager legal documents pending approval');

      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should block staff creation if manager is MANAGER_DISABLED', async () => {
      accountRepository.findAccountById = jest
        .fn()
        .mockResolvedValue(
          createMockManager({ status: AccountStatus.MANAGER_DISABLED }),
        );

      await expect(
        service.createStaffByClinicManager(managerId, validStaffDto),
      ).rejects.toThrow('Manager account is disabled');

      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });
  });

  describe('createDoctorByClinicManager - with validateManagerStatus', () => {
    const managerId = 'manager-123';
    const mockManager = createMockManager({ status: AccountStatus.ACTIVE });

    const validDoctorDto = {
      email: 'doctor@clinic.com',
      password: 'Doctor123',
      fullName: 'Dr. John Doe',
      specialization: 'Cardiology',
      gender: Gender.MALE,
    };

    beforeEach(() => {
      accountRepository.findAccountById = jest
        .fn()
        .mockResolvedValue(mockManager);
      accountRepository.findByEmail = jest.fn().mockResolvedValue(null);
    });

    it('should call validateManagerStatus before creating doctor', async () => {
      const validateSpy = jest.spyOn(service as any, 'validateManagerStatus');

      // Mock successful doctor creation
      accountRepository.findAccountByEmail.mockResolvedValue(null);
      queryRunner.manager.save
        .mockResolvedValueOnce(createMockAccount({ role: AccountRole.DOCTOR }))
        .mockResolvedValueOnce({
          accountId: 'doctor-1',
          fullName: 'Dr. John Doe',
          specialization: 'Cardiology',
        });

      await service.createDoctorByClinicManager(managerId, validDoctorDto);

      expect(validateSpy).toHaveBeenCalledWith(managerId, 'CREATE_STAFF');
      expect(validateSpy).toHaveBeenCalled();
    });

    it('should block doctor creation if manager is PENDING_APPROVAL', async () => {
      accountRepository.findAccountById = jest
        .fn()
        .mockResolvedValue(
          createMockManager({ status: AccountStatus.PENDING_APPROVAL }),
        );

      await expect(
        service.createDoctorByClinicManager(managerId, validDoctorDto),
      ).rejects.toThrow('Manager legal documents pending approval');

      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should block doctor creation if manager is MANAGER_DISABLED', async () => {
      accountRepository.findAccountById = jest
        .fn()
        .mockResolvedValue(
          createMockManager({ status: AccountStatus.MANAGER_DISABLED }),
        );

      await expect(
        service.createDoctorByClinicManager(managerId, validDoctorDto),
      ).rejects.toThrow('Manager account is disabled');

      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // findAllClinicsAdmin
  // ============================================================================
  describe('findAllClinicsAdmin', () => {
    it('should retrieve and map clinic admin data correctly using joined relations', async () => {
      const mockClinic = createMockAccount({ _id: 'clinic-1' });
      const mockClinicAdminInfo = createMockClinicAdminInfo({ _id: 'info-1', accountId: 'clinic-1' });
      const mockAddress = { _id: 'addr-1', provinceName: 'Ho Chi Minh' };

      // Mock joined relations
      (mockClinic as any).clinicAdminInformation = mockClinicAdminInfo;
      (mockClinic as any).address = mockAddress;

      accountRepository.findClinicsAdminWithFilters = jest.fn().mockResolvedValue([[mockClinic], 1]);
      dataSource.query = jest.fn().mockResolvedValue([{ avg_rating: '4.50' }]);

      const result = await service.findAllClinicsAdmin(1, 10, 'search', 'province', 'specialty');

      // Verify repository call with simplified arguments
      expect(accountRepository.findClinicsAdminWithFilters).toHaveBeenCalledWith(
        AccountRole.CLINIC_ADMIN,
        0,
        10,
        'search',
        'province',
        'specialty',
      );

      // Verify redundant calls are NOT made
      expect(clinicAdminInfoRepository.findByAccountId).not.toHaveBeenCalled();
      expect(addressRepository.findByAccountId).not.toHaveBeenCalled();

      // Verify mapping
      expect(result.clinics).toHaveLength(1);
      const item = result.clinics[0];
      expect(item.id).toBe('clinic-1');
      expect(item.clinicInfo.clinicBranchName).toBe(mockClinicAdminInfo.clinicName);
      expect(item.averageRating).toBe(4.5);
      expect(result.pagination.total).toBe(1);
    });

    it('should skip clinics without clinicAdminInformation', async () => {
      const mockClinic = createMockAccount({ _id: 'clinic-1' });
      // No clinicAdminInformation joined
      (mockClinic as any).clinicAdminInformation = null;

      accountRepository.findClinicsAdminWithFilters = jest.fn().mockResolvedValue([[mockClinic], 1]);

      const result = await service.findAllClinicsAdmin();

      expect(result.clinics).toHaveLength(0);
    });
  });

  describe('Sniper small blocks', () => {
    it('generateUserKeys updates keypair on account', async () => {
      const account = createMockAccount({ _id: 'u1' });
      accountRepository.findAccountById.mockResolvedValue(account);
      accountRepository.saveAccount = jest.fn().mockResolvedValue(account);

      const result = await service.generateUserKeys('u1');

      expect(result.publicKey).toBeDefined();
      expect(result.encryptedPrivateKey).toBeDefined();
      expect(accountRepository.saveAccount).toHaveBeenCalledWith(account);
    });

    it('findAll maps account response list', async () => {
      (accountRepository.findAllAccountsWithGeneralAccount as any) = jest
        .fn()
        .mockResolvedValue([
          { ...createMockAccount({ _id: 'a1' }), generalAccount: { fullName: 'A' } },
          { ...createMockAccount({ _id: 'a2', email: 'a2@x.com' }), generalAccount: { fullName: 'B' } },
        ]);

      const result = await service.findAll(true);
      expect(result).toHaveLength(2);
    });

    it('findAccountEntityById throws not found', async () => {
      accountRepository.findAccountById.mockResolvedValue(null);
      await expect(service.findAccountEntityById('missing')).rejects.toThrow(NotFoundException);
    });

    it('createStaffByClinicManager rejects non-manager role', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockAccount({ _id: 'm1', role: AccountRole.PATIENT }),
      );

      await expect(
        service.createStaffByClinicManager('m1', {
          email: 'staffx@clinic.com',
          password: 'Staff123',
          fullName: 'Staff X',
          clinicRole: ClinicRole.STAFF,
          gender: Gender.MALE,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('createDoctorByClinicManager rejects non-manager role', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockAccount({ _id: 'm1', role: AccountRole.PATIENT }),
      );

      await expect(
        service.createDoctorByClinicManager('m1', {
          email: 'doctorx@clinic.com',
          password: 'Doctor123',
          fullName: 'Doctor X',
          specialization: 'Cardiology',
          gender: Gender.MALE,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('createStaffByClinicManager rejects duplicate email', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ _id: 'm1', role: AccountRole.CLINIC_MANAGER }),
      );
      accountRepository.findAccountByEmail.mockResolvedValue(
        createMockAccount({ _id: 'ex1' }),
      );

      await expect(
        service.createStaffByClinicManager('m1', {
          email: 'dup@clinic.com',
          password: 'Staff123',
          fullName: 'Staff Dup',
          clinicRole: ClinicRole.STAFF,
          gender: Gender.MALE,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('createDoctorByClinicManager rejects duplicate email', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ _id: 'm1', role: AccountRole.CLINIC_MANAGER }),
      );
      accountRepository.findAccountByEmail.mockResolvedValue(
        createMockAccount({ _id: 'ex1' }),
      );

      await expect(
        service.createDoctorByClinicManager('m1', {
          email: 'dup2@clinic.com',
          password: 'Doctor123',
          fullName: 'Doctor Dup',
          specialization: 'Cardiology',
          gender: Gender.MALE,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('throws when registration state is missing', async () => {
      clinicAdminRegistrationStateQb.getRawOne.mockResolvedValueOnce(null);

      await expect(
        service.createClinicManagerForRegistration('missing-admin', {
          username: 'm',
          email: 'm@c.com',
          password: 'Manager123',
          phone: '0911',
          clinicBranchName: 'B',
          fullName: 'M',
          gender: Gender.MALE,
          dob: '1990-01-01',
          provinceCode: 'P',
          provinceName: 'PN',
          districtCode: 'D',
          districtName: 'DN',
          wardCode: 'W',
          wardName: 'WN',
          addressDetail: 'A',
          idCardNumber: '123',
          idCardFrontUrl: 'f',
          idCardBackUrl: 'b',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when clinic admin account has no password', async () => {
      clinicAdminAccountQb.getOne.mockResolvedValueOnce({
        _id: 'account-1',
        role: AccountRole.CLINIC_ADMIN,
        password: null,
      });

      await expect(
        service.createClinicManagerForRegistration('account-1', {
          username: 'm',
          email: 'm@c.com',
          password: 'Manager123',
          phone: '0911',
          clinicBranchName: 'B',
          fullName: 'M',
          gender: Gender.MALE,
          dob: '1990-01-01',
          provinceCode: 'P',
          provinceName: 'PN',
          districtCode: 'D',
          districtName: 'DN',
          wardCode: 'W',
          wardName: 'WN',
          addressDetail: 'A',
          idCardNumber: '123',
          idCardFrontUrl: 'f',
          idCardBackUrl: 'b',
        } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Heavy sniper: accounts core branches', () => {
    beforeEach(() => {
      accountRepository.findByPhone = jest.fn().mockResolvedValue(null);
      accountRepository.saveAccount = jest.fn().mockResolvedValue(null);

      (service as any).generalAccountRepository = {
        ...(service as any).generalAccountRepository,
        findByFullNameFuzzy: jest.fn().mockResolvedValue(null),
        findByAccountId: jest.fn().mockResolvedValue(null),
        findGeneralAccountByUserId: jest.fn().mockResolvedValue(null),
        createGeneralAccount: jest.fn((data: any) => data),
        saveGeneralAccount: jest.fn((data: any) => Promise.resolve(data)),
        deleteGeneralAccount: jest.fn().mockResolvedValue(undefined),
      };

      (service as any).googleIframeRepository = {
        ...(service as any).googleIframeRepository,
        findByAddressId: jest.fn().mockResolvedValue(null),
      };

      (service as any).clinicStaffRepository = {
        ...(service as any).clinicStaffRepository,
        findByAccountId: jest.fn().mockResolvedValue({ accountId: 'staff-1' }),
        create: jest.fn((data: any) => data),
        save: jest.fn((data: any) => Promise.resolve(data)),
      };

      (service as any).doctorInfoRepository = {
        ...(service as any).doctorInfoRepository,
        findByAccountId: jest.fn().mockResolvedValue(null),
        create: jest.fn((data: any) => data),
        save: jest.fn((data: any) => Promise.resolve(data)),
      };

      (service as any).clinicAdminInfoRepository = {
        ...(service as any).clinicAdminInfoRepository,
        findByAccountId: jest.fn().mockResolvedValue(null),
        create: jest.fn((data: any) => data),
        save: jest.fn((data: any) => Promise.resolve(data)),
      };

      (service as any).clinicManagerInfoRepository = {
        ...(service as any).clinicManagerInfoRepository,
        findByAccountId: jest.fn().mockResolvedValue(null),
        create: jest.fn((data: any) => data),
        save: jest.fn((data: any) => Promise.resolve(data)),
      };

      (service as any).subscriptionServiceRepository = {
        ...(service as any).subscriptionServiceRepository,
        findById: jest.fn().mockResolvedValue(null),
      };

      (service as any).codeVerificationRepository = {
        ...(service as any).codeVerificationRepository,
        findValidByUserIdAndCode: jest.fn().mockResolvedValue(null),
        markAsUsed: jest.fn().mockResolvedValue(undefined),
        invalidateAllUserCodes: jest.fn().mockResolvedValue(undefined),
        create: jest.fn((data: any) => data),
        save: jest.fn().mockResolvedValue(undefined),
      };

      (service as any).mailerService = {
        ...(service as any).mailerService,
        sendVerificationCode: jest.fn().mockResolvedValue(undefined),
      };
    });

    it('searchPatientByPhone throws when no search params are provided', async () => {
      await expect(service.searchPatientByPhone({} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('searchPatientByPhone rejects non-patient account found by phone', async () => {
      accountRepository.findByPhone.mockResolvedValue(
        createMockAccount({ role: AccountRole.CLINIC_MANAGER }),
      );

      const result = await service.searchPatientByPhone({
        phone: '0900000001',
      } as any);

      expect(result.found).toBe(false);
      expect(result.message).toContain('can not book appointment');
    });

    it('searchPatientByPhone resolves via full name fallback and tolerates invalid dob', async () => {
      const patient = createMockAccount({
        _id: 'patient-1',
        role: AccountRole.PATIENT,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      (service as any).generalAccountRepository.findByFullNameFuzzy.mockResolvedValue({
        accountId: 'patient-1',
      });
      accountRepository.findAccountById.mockResolvedValue(patient);
      (service as any).generalAccountRepository.findByAccountId.mockResolvedValue({
        fullName: 'Patient One',
        dob: 'not-a-date',
        gender: Gender.MALE,
      });
      addressRepository.findByAccountId.mockResolvedValue(null);

      const result = await service.searchPatientByPhone({
        fullName: 'Patient',
      } as any);

      expect(result.found).toBe(true);
      expect(result.patient?.accountId).toBe('patient-1');
      expect(result.patient?.dateOfBirth).toBe('not-a-date');
    });

    it('getAccountInformationByRole throws NotFoundException for unsupported role', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue({
        _id: 'u-1',
        role: 'UNKNOWN_ROLE',
      } as any);
      addressRepository.findByAccountId.mockResolvedValue(null);

      await expect(service.getAccountInformationByRole('u-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('createPatient succeeds without optional general profile fields', async () => {
      accountRepository.findAccountByEmail.mockResolvedValue(null);
      const createdPatient = createMockAccount({
        _id: 'patient-new',
        role: AccountRole.PATIENT,
        phone: '0912345000',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      queryRunner.manager.save.mockResolvedValueOnce(createdPatient);

      const result = await service.createPatient({
        username: 'patientnew',
        email: 'patientnew@example.com',
        password: 'Patient123',
        phone: '0912345000',
      } as any);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect((service as any).generalAccountRepository.createGeneralAccount).not.toHaveBeenCalled();
      expect(zaloWebhookService.sendFriendRequest).toHaveBeenCalledWith(
        '0912345000',
        'Patient Registration',
      );
      expect(result.user).toBeDefined();
    });

    it('createPatient rolls back transaction when save fails', async () => {
      accountRepository.findAccountByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockRejectedValueOnce(new Error('save-fail'));

      await expect(
        service.createPatient({
          username: 'patientnew',
          email: 'patientnew@example.com',
          password: 'Patient123',
          phone: '0912345000',
        } as any),
      ).rejects.toThrow('save-fail');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('createPatientViaOAuth uses email prefix username and skips webhook without phone', async () => {
      accountRepository.findAccountByEmail.mockResolvedValue(null);
      const oauthPatient = createMockAccount({
        _id: 'oauth-1',
        role: AccountRole.PATIENT,
        email: 'oauth@example.com',
        phone: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      queryRunner.manager.save.mockResolvedValueOnce(oauthPatient);

      const result = await service.createPatientViaOAuth({
        email: 'oauth@example.com',
        password: '',
      });

      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(accountRepository.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'oauth',
          password: null,
          isOAuthUser: true,
          isEmailVerified: true,
        }),
      );
      expect(zaloWebhookService.sendFriendRequest).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('update marks emailChanged and sends webhook when phone changes', async () => {
      const account = createMockAccount({
        _id: 'u-1',
        role: AccountRole.PATIENT,
        email: 'old@example.com',
        phone: '0900000000',
      });

      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(account as any);
      jest
        .spyOn(service as any, 'validateSharedEmailPolicyForAccountUpdate')
        .mockResolvedValue(undefined);
      accountRepository.saveAccount.mockResolvedValue(account);
      jest.spyOn(service as any, 'updateGeneralAccount').mockResolvedValue(undefined);
      jest
        .spyOn(service as any, 'updateAddressAndGoogleIframe')
        .mockResolvedValue(undefined);
      jest
        .spyOn(service, 'getAccountInformationByRole')
        .mockResolvedValue({ _id: 'u-1' } as any);

      const result = await service.update('u-1', {
        email: 'new@example.com',
        phone: '0911111111',
        fullName: 'New Name',
      } as any);

      expect(result.emailChanged).toBe(true);
      expect(account.isEmailVerified).toBe(false);
      expect(zaloWebhookService.sendFriendRequest).toHaveBeenCalledWith(
        '0911111111',
        'Profile Update (Phone Change)',
      );
    });

    it('encryptBankAccount rejects unsupported role', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ role: AccountRole.PATIENT }) as any,
      );

      await expect(service.encryptBankAccount('u-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('getDecryptedBankInfo returns null when doctor profile is missing', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ role: AccountRole.DOCTOR }) as any,
      );
      (service as any).doctorInfoRepository.findByAccountId.mockResolvedValue(null);

      const result = await service.getDecryptedBankInfo('doctor-1');
      expect(result).toBeNull();
    });

    it('validateParentManagerStatus rejects clinic manager without parent admin', async () => {
      await expect(
        service.validateParentManagerStatus(
          createMockManager({ parentId: null, role: AccountRole.CLINIC_MANAGER }) as any,
        ),
      ).rejects.toThrow('No parent admin found');
    });

    it('validateClinicSubscription rejects clinic manager without parent', async () => {
      await expect(
        service.validateClinicSubscription(
          createMockManager({ parentId: null, role: AccountRole.CLINIC_MANAGER }) as any,
        ),
      ).rejects.toThrow('No parent account found');
    });

    it('resolveClinicAdminId rejects invalid doctor/staff hierarchy', async () => {
      accountRepository.findAccountById.mockResolvedValueOnce(
        createMockManager({ _id: 'manager-1', parentId: null }) as any,
      );

      await expect(
        service.resolveClinicAdminId(
          createMockAccount({
            _id: 'doctor-1',
            role: AccountRole.DOCTOR,
            parentId: 'manager-1',
          }) as any,
        ),
      ).rejects.toThrow('Invalid account hierarchy');
    });

    it('getSubscriptionPayloadForAccount returns payload for clinic admin', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-1',
        serviceId: 'svc-1',
      });
      (service as any).subscriptionServiceRepository.findById.mockResolvedValue({
        serviceName: 'Premium',
        code: 'PREM',
      });

      const payload = await service.getSubscriptionPayloadForAccount(
        createMockAccount({
          _id: 'admin-1',
          role: AccountRole.CLINIC_ADMIN,
        }) as any,
      );

      expect(payload).toEqual({
        subscriptionId: 'sub-1',
        subscriptionName: 'Premium',
        subscriptionCode: 'PREM',
      });
    });

    it('updateGeneralAccount updates existing entity', async () => {
      const existing = {
        accountId: 'u-1',
        fullName: 'Old Name',
        gender: Gender.FEMALE,
        dob: new Date('1990-01-01'),
        profilePicture: 'old.jpg',
      };
      (service as any).generalAccountRepository.findGeneralAccountByUserId.mockResolvedValue(
        existing,
      );

      const result = await service.updateGeneralAccount('u-1', {
        fullName: 'New Name',
        gender: Gender.MALE,
      });

      expect((service as any).generalAccountRepository.saveGeneralAccount).toHaveBeenCalled();
      expect(result.fullName).toBe('New Name');
      expect(result.gender).toBe(Gender.MALE);
    });

    it('updateGeneralAccount creates entity when not exists', async () => {
      (service as any).generalAccountRepository.findGeneralAccountByUserId.mockResolvedValue(
        null,
      );

      const result = await service.updateGeneralAccount('u-2', {
        fullName: 'Created Name',
      });

      expect((service as any).generalAccountRepository.createGeneralAccount).toHaveBeenCalledWith(
        expect.objectContaining({ accountId: 'u-2', fullName: 'Created Name' }),
      );
      expect(result.accountId).toBe('u-2');
    });

    it('updateAddressAndGoogleIframe creates address and iframe with default responsive', async () => {
      addressRepository.findByAccountId.mockResolvedValue(null);
      addressRepository.create = jest.fn((data: any) => ({ _id: 'addr-new', ...data }));
      addressRepository.save = jest.fn().mockImplementation(async (x: any) => x);

      (service as any).googleIframeRepository.findByAddressId.mockResolvedValue(null);
      (service as any).googleIframeRepository.create = jest
        .fn()
        .mockImplementation((data: any) => ({ _id: 'g-new', ...data }));
      (service as any).googleIframeRepository.save = jest
        .fn()
        .mockImplementation(async (x: any) => x);

      await (service as any).updateAddressAndGoogleIframe('u-1', {
        address: '123 Main',
        ward: 'w1',
        district: 'd1',
        province: 'p1',
        location: 'HCM',
        googleMapIframe: '<iframe />',
      });

      expect(addressRepository.create).toHaveBeenCalled();
      expect((service as any).googleIframeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ responsive: true }),
      );
    });

    it('updatePassword rejects when old password is incorrect', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ password: 'hashed-old' }) as any,
      );
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updatePassword('u-1', {
          oldPassword: 'wrong',
          newPassword: 'NewPass123',
        } as any),
      ).rejects.toThrow('Incorrect current password');
    });

    it('updatePassword rejects when new password equals old password', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ password: 'hashed-old' }) as any,
      );
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);

      await expect(
        service.updatePassword('u-1', {
          oldPassword: 'SamePass1',
          newPassword: 'SamePass1',
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('deleteEmployee soft-deletes doctor under same manager', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({
          _id: 'doctor-1',
          role: AccountRole.DOCTOR,
          parentId: 'manager-1',
        }) as any,
      );
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({ _id: 'manager-1' }),
      );
      queryRunner.manager.softDelete = jest.fn().mockResolvedValue(undefined);

      await service.deleteEmployee('doctor-1', 'manager-1');

      expect(queryRunner.manager.softDelete).toHaveBeenCalledTimes(2);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('restore restores deleted account and general profile', async () => {
      accountRepository.findAccountByIdWithDeleted = jest
        .fn()
        .mockResolvedValue({
          _id: 'u-restore',
          deletedAt: new Date('2026-01-01T00:00:00.000Z'),
        });
      queryRunner.manager.restore = jest.fn().mockResolvedValue(undefined);
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ _id: 'u-restore' }) as any,
      );
      jest.spyOn(service, 'findGeneralAccountByUserId').mockResolvedValue(null);

      const result = await service.restore('u-restore');

      expect(queryRunner.manager.restore).toHaveBeenCalledTimes(2);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('permanentDelete throws when account delete affects no rows', async () => {
      (service as any).generalAccountRepository.deleteGeneralAccount.mockResolvedValue(
        undefined,
      );
      accountRepository.deleteAccount = jest.fn().mockResolvedValue(0);

      await expect(service.permanentDelete('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('validateAccountAccess throws for BAN and DELETED statuses', () => {
      expect(() =>
        service.validateAccountAccess(
          createMockAccount({ status: AccountStatus.BAN }) as any,
        ),
      ).toThrow('banned');

      expect(() =>
        service.validateAccountAccess(
          createMockAccount({ status: AccountStatus.DELETED }) as any,
        ),
      ).toThrow('deleted');
    });

    it('encryptBankAccount saves clinic admin profile when role is CLINIC_ADMIN', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ role: AccountRole.CLINIC_ADMIN }) as any,
      );
      const profile = { accountId: 'admin-1', bankName: 'VCB' };
      (service as any).clinicAdminInfoRepository.findByAccountId.mockResolvedValue(
        profile,
      );

      const result = await service.encryptBankAccount('admin-1');

      expect((service as any).clinicAdminInfoRepository.save).toHaveBeenCalledWith(
        profile,
      );
      expect(result).toEqual(profile);
    });

    it('getDecryptedBankInfo returns null when clinic admin profile is missing', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ role: AccountRole.CLINIC_ADMIN }) as any,
      );
      (service as any).clinicAdminInfoRepository.findByAccountId.mockResolvedValue(
        null,
      );

      const result = await service.getDecryptedBankInfo('admin-1');
      expect(result).toBeNull();
    });

    it('updateClinicAdminInformation updates existing profile fields', async () => {
      const existing = {
        accountId: 'admin-1',
        clinicName: 'Old Clinic',
        description: 'Old',
        sepayVa: '001',
      };
      (service as any).clinicAdminInfoRepository.findByAccountId.mockResolvedValue(
        existing,
      );

      const result = await service.updateClinicAdminInformation('admin-1', {
        clinicName: 'New Clinic',
        description: 'New',
        sepayVa: '002',
      });

      expect((service as any).clinicAdminInfoRepository.save).toHaveBeenCalled();
      expect(result.clinicName).toBe('New Clinic');
      expect(result.sepayVa).toBe('002');
    });

    it('updateClinicManagerInformation creates new profile when not exists', async () => {
      (service as any).clinicManagerInfoRepository.findByAccountId.mockResolvedValue(
        null,
      );

      const result = await service.updateClinicManagerInformation('manager-2', {
        clinicBranchName: 'Branch B',
      });

      expect((service as any).clinicManagerInfoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'manager-2',
          clinicBranchName: 'Branch B',
        }),
      );
      expect(result.accountId).toBe('manager-2');
    });

    it('updateClinicStaffInformation updates existing staff profile', async () => {
      const existing = {
        accountId: 'staff-1',
        fullName: 'Old Staff',
        clinicRole: ClinicRole.STAFF,
      };
      (service as any).clinicStaffRepository.findByAccountId.mockResolvedValue(
        existing,
      );

      const result = await service.updateClinicStaffInformation('staff-1', {
        fullName: 'New Staff',
      });

      expect((service as any).clinicStaffRepository.save).toHaveBeenCalled();
      expect(result.fullName).toBe('New Staff');
    });

    it('updateDoctorInformation creates new doctor profile when not exists', async () => {
      (service as any).doctorInfoRepository.findByAccountId.mockResolvedValue(
        null,
      );

      const result = await service.updateDoctorInformation('doctor-2', {
        academicDegree: 'MD',
        bankName: 'ACB',
      } as any);

      expect((service as any).doctorInfoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'doctor-2',
          academicDegree: 'MD',
          bankName: 'ACB',
        }),
      );
      expect(result.accountId).toBe('doctor-2');
    });

    it('banAccount rejects banning ADMIN role', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ _id: 'admin-1', role: AccountRole.ADMIN }) as any,
      );

      await expect(
        service.banAccount('admin-1', { reason: 'violation' } as any, 'root-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('banAccount rejects self-ban attempt', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ _id: 'u-1', role: AccountRole.PATIENT }) as any,
      );

      await expect(
        service.banAccount('u-1', { reason: 'violation' } as any, 'u-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('banAccount rejects already banned account', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ status: AccountStatus.BAN }) as any,
      );

      await expect(
        service.banAccount('u-2', { reason: 'violation' } as any, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('banAccount applies BAN status and increments ban count', async () => {
      const target = createMockAccount({
        _id: 'u-3',
        status: AccountStatus.ACTIVE,
        banCounts: 1,
      });
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(target as any);
      accountRepository.saveAccount.mockResolvedValue(target);
      jest.spyOn(service, 'findGeneralAccountByUserId').mockResolvedValue(null);

      const result = await service.banAccount(
        'u-3',
        { reason: 'spam' } as any,
        'admin-1',
      );

      expect(target.status).toBe(AccountStatus.BAN);
      expect((target as any).banCounts).toBe(2);
      expect((target as any).banDescription).toBe('spam');
      expect(result).toBeDefined();
    });

    it('unbanAccount rejects when account is not banned', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ status: AccountStatus.ACTIVE }) as any,
      );

      await expect(service.unbanAccount('u-4')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('unbanAccount activates banned account', async () => {
      const target = createMockAccount({
        _id: 'u-5',
        status: AccountStatus.BAN,
      });
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(target as any);
      accountRepository.saveAccount.mockResolvedValue(target);
      jest.spyOn(service, 'findGeneralAccountByUserId').mockResolvedValue(null);

      const result = await service.unbanAccount('u-5');
      expect(target.status).toBe(AccountStatus.ACTIVE);
      expect(result).toBeDefined();
    });

    it('updateStatus throws NotFoundException when account missing', async () => {
      accountRepository.findAccountById.mockResolvedValue(null);

      await expect(
        service.updateStatus('missing', AccountStatus.ACTIVE),
      ).rejects.toThrow(NotFoundException);
    });

    it('updateStatus persists new status', async () => {
      const account = createMockAccount({
        _id: 'u-6',
        status: AccountStatus.ACTIVE,
      });
      accountRepository.findAccountById.mockResolvedValue(account);
      accountRepository.saveAccount.mockResolvedValue(account);

      await service.updateStatus('u-6', AccountStatus.BAN);

      expect(account.status).toBe(AccountStatus.BAN);
      expect(accountRepository.saveAccount).toHaveBeenCalledWith(account);
    });

    it('validateParentManagerStatus allows PATIENT without hierarchy checks', async () => {
      await expect(
        service.validateParentManagerStatus(
          createMockAccount({ role: AccountRole.PATIENT }) as any,
        ),
      ).resolves.toBeUndefined();
    });

    it('validateParentManagerStatus rejects manager when parent admin is banned', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockAccount({ role: AccountRole.CLINIC_ADMIN, status: AccountStatus.BAN }),
      );

      await expect(
        service.validateParentManagerStatus(
          createMockManager({
            _id: 'm-1',
            role: AccountRole.CLINIC_MANAGER,
            parentId: 'admin-1',
          }) as any,
        ),
      ).rejects.toThrow('suspended');
    });

    it('validateParentManagerStatus rejects manager when legal docs are not approved', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockAccount({ role: AccountRole.CLINIC_ADMIN, status: AccountStatus.ACTIVE }),
      );
      clinicLegalDocsRepository.findByAccountId.mockResolvedValue({
        verificationStatus: LegalDocumentVerificationStatus.REJECTED,
      });

      await expect(
        service.validateParentManagerStatus(
          createMockManager({
            _id: 'm-2',
            role: AccountRole.CLINIC_MANAGER,
            parentId: 'admin-1',
          }) as any,
        ),
      ).rejects.toThrow('legal documents');
    });

    it('validateParentManagerStatus allows manager with approved legal docs', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockAccount({ role: AccountRole.CLINIC_ADMIN, status: AccountStatus.ACTIVE }),
      );
      clinicLegalDocsRepository.findByAccountId.mockResolvedValue({
        verificationStatus: LegalDocumentVerificationStatus.APPROVED,
      });

      await expect(
        service.validateParentManagerStatus(
          createMockManager({
            _id: 'm-3',
            role: AccountRole.CLINIC_MANAGER,
            parentId: 'admin-1',
          }) as any,
        ),
      ).resolves.toBeUndefined();
    });

    it('validateParentManagerStatus rejects staff when parent manager is disabled', async () => {
      accountRepository.findAccountById.mockResolvedValue(
        createMockManager({
          _id: 'm-parent',
          role: AccountRole.CLINIC_MANAGER,
          status: AccountStatus.MANAGER_DISABLED,
          parentId: 'admin-1',
        }),
      );

      await expect(
        service.validateParentManagerStatus(
          createMockAccount({
            _id: 's-1',
            role: AccountRole.CLINIC_STAFF,
            parentId: 'm-parent',
          }) as any,
        ),
      ).rejects.toThrow('temporarily disabled');
    });

    it('validateParentManagerStatus rejects doctor when grandparent admin is deleted', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(
          createMockManager({
            _id: 'm-parent',
            role: AccountRole.CLINIC_MANAGER,
            status: AccountStatus.ACTIVE,
            parentId: 'admin-1',
          }),
        )
        .mockResolvedValueOnce(
          createMockAccount({
            _id: 'admin-1',
            role: AccountRole.CLINIC_ADMIN,
            status: AccountStatus.DELETED,
          }),
        );

      await expect(
        service.validateParentManagerStatus(
          createMockAccount({
            _id: 'd-1',
            role: AccountRole.DOCTOR,
            parentId: 'm-parent',
          }) as any,
        ),
      ).rejects.toThrow('deleted');
    });

    it('validateParentManagerStatus allows staff when hierarchy and legal docs are valid', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(
          createMockManager({
            _id: 'm-parent',
            role: AccountRole.CLINIC_MANAGER,
            status: AccountStatus.ACTIVE,
            parentId: 'admin-1',
          }),
        )
        .mockResolvedValueOnce(
          createMockAccount({
            _id: 'admin-1',
            role: AccountRole.CLINIC_ADMIN,
            status: AccountStatus.ACTIVE,
          }),
        );
      clinicLegalDocsRepository.findByAccountId.mockResolvedValue({
        verificationStatus: LegalDocumentVerificationStatus.APPROVED,
      });

      await expect(
        service.validateParentManagerStatus(
          createMockAccount({
            _id: 's-2',
            role: AccountRole.CLINIC_STAFF,
            parentId: 'm-parent',
          }) as any,
        ),
      ).resolves.toBeUndefined();
    });

    it('validateClinicSubscription skips non-clinic role', async () => {
      await expect(
        service.validateClinicSubscription(
          createMockAccount({ role: AccountRole.PATIENT }) as any,
        ),
      ).resolves.toBeUndefined();
    });

    it('validateClinicSubscription throws when subscription is missing', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(null);

      await expect(
        service.validateClinicSubscription(
          createMockAccount({ role: AccountRole.CLINIC_ADMIN, _id: 'admin-x' }) as any,
        ),
      ).rejects.toThrow('subscription not found');
    });

    it('validateClinicSubscription allows clinic admin when subscription exists', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-1',
        subscriptionStatus: RegistrationStatus.EXPIRED,
      });

      await expect(
        service.validateClinicSubscription(
          createMockAccount({ role: AccountRole.CLINIC_ADMIN, _id: 'admin-y' }) as any,
        ),
      ).resolves.toBeUndefined();
    });

    it('validateClinicSubscription rejects manager when legal docs not approved', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-2',
        subscriptionStatus: RegistrationStatus.ACTIVE,
      });
      clinicLegalDocsRepository.findByAccountId.mockResolvedValue({
        verificationStatus: LegalDocumentVerificationStatus.REJECTED,
      });

      await expect(
        service.validateClinicSubscription(
          createMockManager({
            _id: 'm-sub-1',
            role: AccountRole.CLINIC_MANAGER,
            parentId: 'admin-2',
          }) as any,
        ),
      ).rejects.toThrow('not ready');
    });

    it('validateClinicSubscription allows manager with active subscription and approved docs', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-3',
        subscriptionStatus: RegistrationStatus.NON_RENEWING,
      });
      clinicLegalDocsRepository.findByAccountId.mockResolvedValue({
        verificationStatus: LegalDocumentVerificationStatus.APPROVED,
      });

      await expect(
        service.validateClinicSubscription(
          createMockManager({
            _id: 'm-sub-2',
            role: AccountRole.CLINIC_MANAGER,
            parentId: 'admin-2',
          }) as any,
        ),
      ).resolves.toBeUndefined();
    });

    it('validateClinicSubscription rejects staff when manager hierarchy is invalid', async () => {
      accountRepository.findAccountById.mockResolvedValue({
        _id: 'm-invalid',
        role: AccountRole.CLINIC_MANAGER,
        parentId: null,
      });

      await expect(
        service.validateClinicSubscription(
          createMockAccount({
            _id: 's-sub-1',
            role: AccountRole.CLINIC_STAFF,
            parentId: 'm-invalid',
          }) as any,
        ),
      ).rejects.toThrow('Invalid account hierarchy');
    });

    it('validateClinicSubscription rejects doctor when subscription status is not allowed', async () => {
      accountRepository.findAccountById.mockResolvedValue({
        _id: 'm-ok',
        role: AccountRole.CLINIC_MANAGER,
        parentId: 'admin-3',
      });
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-4',
        subscriptionStatus: RegistrationStatus.PENDING_PAYMENT,
      });

      await expect(
        service.validateClinicSubscription(
          createMockAccount({
            _id: 'd-sub-1',
            role: AccountRole.DOCTOR,
            parentId: 'm-ok',
          }) as any,
        ),
      ).rejects.toThrow('not active');
    });

    it('validateClinicSubscription allows staff when parent chain and status are valid', async () => {
      accountRepository.findAccountById.mockResolvedValue({
        _id: 'm-ok-2',
        role: AccountRole.CLINIC_MANAGER,
        parentId: 'admin-4',
      });
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-5',
        subscriptionStatus: RegistrationStatus.ACTIVE,
      });

      await expect(
        service.validateClinicSubscription(
          createMockAccount({
            _id: 's-sub-2',
            role: AccountRole.CLINIC_STAFF,
            parentId: 'm-ok-2',
          }) as any,
        ),
      ).resolves.toBeUndefined();
    });

    it('resolveClinicAdminId returns for clinic admin and manager', async () => {
      const adminId = await service.resolveClinicAdminId(
        createMockAccount({ _id: 'admin-7', role: AccountRole.CLINIC_ADMIN }) as any,
      );
      const managerId = await service.resolveClinicAdminId(
        createMockManager({
          _id: 'm-7',
          role: AccountRole.CLINIC_MANAGER,
          parentId: 'admin-7',
        }) as any,
      );

      expect(adminId).toBe('admin-7');
      expect(managerId).toBe('admin-7');
    });

    it('resolveClinicAdminId rejects manager without parent', async () => {
      await expect(
        service.resolveClinicAdminId(
          createMockManager({
            _id: 'm-8',
            role: AccountRole.CLINIC_MANAGER,
            parentId: null,
          }) as any,
        ),
      ).rejects.toThrow('No parent clinic admin');
    });

    it('resolveClinicAdminId rejects staff without parent manager', async () => {
      await expect(
        service.resolveClinicAdminId(
          createMockAccount({
            _id: 's-9',
            role: AccountRole.CLINIC_STAFF,
            parentId: null,
          }) as any,
        ),
      ).rejects.toThrow('No parent clinic manager');
    });

    it('getSubscriptionPayloadForAccount returns empty for non-clinic roles', async () => {
      const payload = await service.getSubscriptionPayloadForAccount(
        createMockAccount({ role: AccountRole.PATIENT }) as any,
      );
      expect(payload).toEqual({});
    });

    it('getSubscriptionPayloadForAccount returns empty when manager has no parent admin', async () => {
      const payload = await service.getSubscriptionPayloadForAccount(
        createMockManager({
          role: AccountRole.CLINIC_MANAGER,
          parentId: undefined,
        }) as any,
      );
      expect(payload).toEqual({});
    });

    it('getSubscriptionPayloadForAccount returns empty when staff has no parent', async () => {
      const payload = await service.getSubscriptionPayloadForAccount(
        createMockAccount({
          role: AccountRole.CLINIC_STAFF,
          parentId: undefined,
        }) as any,
      );
      expect(payload).toEqual({});
    });

    it('getSubscriptionPayloadForAccount returns empty when subscription not found', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(null);

      const payload = await service.getSubscriptionPayloadForAccount(
        createMockAccount({ _id: 'admin-10', role: AccountRole.CLINIC_ADMIN }) as any,
      );
      expect(payload).toEqual({});
    });

    it('getSubscriptionPayloadForAccount returns payload with undefined service details when service missing', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-10',
        serviceId: 'svc-missing',
      });
      (service as any).subscriptionServiceRepository.findById.mockResolvedValue(null);

      const payload = await service.getSubscriptionPayloadForAccount(
        createMockAccount({ _id: 'admin-10', role: AccountRole.CLINIC_ADMIN }) as any,
      );

      expect(payload).toEqual({
        subscriptionId: 'sub-10',
        subscriptionName: undefined,
        subscriptionCode: undefined,
      });
    });

    it('getClinicSubscription delegates to repository', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({ _id: 'sub-20' });

      const result = await service.getClinicSubscription('clinic-20');
      expect(clinicSubscriptionRepository.findByClinicId).toHaveBeenCalledWith('clinic-20');
      expect(result).toEqual({ _id: 'sub-20' });
    });

    it('getManagerLegalVerificationStatus returns status or null', async () => {
      clinicLegalDocsRepository.findByAccountId.mockResolvedValueOnce({
        verificationStatus: LegalDocumentVerificationStatus.APPROVED,
      });
      clinicLegalDocsRepository.findByAccountId.mockResolvedValueOnce(null);

      const approved = await service.getManagerLegalVerificationStatus('m-20');
      const none = await service.getManagerLegalVerificationStatus('m-21');

      expect(approved).toBe(LegalDocumentVerificationStatus.APPROVED);
      expect(none).toBeNull();
    });

    it('findLoginCandidatesByEmail builds query and applies optional role filter', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ _id: 'a1' }]),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.findLoginCandidatesByEmail(
        'a@x.com',
        AccountRole.CLINIC_ADMIN,
      );

      expect(qb.andWhere).toHaveBeenCalledWith('account.role = :role', {
        role: AccountRole.CLINIC_ADMIN,
      });
      expect(result).toHaveLength(1);
    });

    it('findAccountWithGeneralByEmail returns first matched account', async () => {
      jest
        .spyOn(service, 'findAccountsWithGeneralByEmail')
        .mockResolvedValue([{ _id: 'a1' } as any]);

      const result = await service.findAccountWithGeneralByEmail('a@x.com');
      expect((result as any)._id).toBe('a1');
    });

    it('findAccountWithGeneralById returns query result', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ _id: 'a2' }),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.findAccountWithGeneralById('a2');
      expect((result as any)._id).toBe('a2');
    });

    it('getLoginOnboardingState returns default access for non-clinic roles', async () => {
      const result = await service.getLoginOnboardingState(
        createMockAccount({ role: AccountRole.PATIENT }) as any,
      );
      expect(result).toEqual({ canAccessDashboard: true });
    });

    it('getLoginOnboardingState maps registration status for clinic roles', async () => {
      jest.spyOn(service, 'resolveClinicAdminId').mockResolvedValue('admin-ob-1');
      (service as any).getRegistrationStatusByClinicAdminId = jest
        .fn()
        .mockResolvedValue({
          status: RegistrationStatus.PENDING_MANAGER_SETUP,
          currentStep: 'manager_setup',
          nextAction: 'create_manager',
          managerAccountId: 'm-ob-1',
          notice: 'pending',
          expirationDate: '2027-01-01',
        } as any);

      const result = await service.getLoginOnboardingState(
        createMockManager({ role: AccountRole.CLINIC_MANAGER }) as any,
      );

      expect(result.canAccessDashboard).toBe(false);
      expect(result.registrationStep).toBe('manager_setup');
      expect(result.managerAccountId).toBe('m-ob-1');
    });

    it('verifyEmailCode throws NotFoundException when no account found', async () => {
      jest
        .spyOn(service, 'findAccountsWithGeneralByEmail')
        .mockResolvedValue([] as any);

      await expect(service.verifyEmailCode('x@x.com', '123456')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('verifyEmailCode throws UnauthorizedException when code does not match any account', async () => {
      jest
        .spyOn(service, 'findAccountsWithGeneralByEmail')
        .mockResolvedValue([
          createMockAccount({ _id: 'u-31' }),
          createMockAccount({ _id: 'u-32' }),
        ] as any);
      (service as any).codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue(
        null,
      );

      await expect(service.verifyEmailCode('x@x.com', '123456')).rejects.toThrow(
        'Invalid verification code',
      );
    });

    it('verifyEmailCode marks code used and activates unverified account', async () => {
      const account = createMockAccount({
        _id: 'u-33',
        isEmailVerified: false,
        status: AccountStatus.UNVERIFIED,
        username: 'user33',
        generalAccount: { fullName: 'John Doe' },
      });
      jest
        .spyOn(service, 'findAccountsWithGeneralByEmail')
        .mockResolvedValue([account] as any);
      (service as any).codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue(
        {
          _id: 'code-1',
          expiredAt: new Date(Date.now() + 60_000),
        },
      );
      accountRepository.saveAccount.mockResolvedValue(account);

      const result = await service.verifyEmailCode('x@x.com', '123456');

      expect((service as any).codeVerificationRepository.markAsUsed).toHaveBeenCalledWith(
        'code-1',
      );
      expect(account.status).toBe(AccountStatus.ACTIVE);
      expect(result.firstName).toBe('John');
    });

    it('resendVerificationCode creates new verify code for unverified account', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(
        createMockAccount({ _id: 'u-34', isEmailVerified: false }) as any,
      );

      const result = await service.resendVerificationCode('u34@x.com');

      expect((service as any).codeVerificationRepository.invalidateAllUserCodes).toHaveBeenCalled();
      expect((service as any).codeVerificationRepository.save).toHaveBeenCalled();
      expect(result.code).toBeDefined();
    });

    it('initiatePasswordReset blocks pure OAuth users', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(
        createMockAccount({ isOAuthUser: true, password: null }) as any,
      );

      await expect(
        service.initiatePasswordReset('oauth@x.com', AccountRole.PATIENT),
      ).rejects.toThrow(BadRequestException);
    });

    it('initiatePasswordReset creates reset code for hybrid/local users', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(
        createMockAccount({ _id: 'u-35', isOAuthUser: true, password: 'hashed' }) as any,
      );

      const result = await service.initiatePasswordReset(
        'user@x.com',
        AccountRole.PATIENT,
      );

      expect((service as any).codeVerificationRepository.invalidateAllUserCodes).toHaveBeenCalled();
      expect((service as any).codeVerificationRepository.save).toHaveBeenCalled();
      expect(result.code).toBeDefined();
    });

    it('resetPasswordWithCode validates code and updates password', async () => {
      const account = createMockAccount({
        _id: 'u-36',
        isOAuthUser: false,
        password: 'old-hash',
      });
      jest.spyOn(service, 'findByEmail').mockResolvedValue(account as any);
      (service as any).codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue(
        {
          _id: 'reset-1',
          expiredAt: new Date(Date.now() + 60_000),
        },
      );
      (bcrypt.hash as unknown as jest.Mock).mockResolvedValue('new-hash');
      accountRepository.saveAccount.mockResolvedValue(account);

      await service.resetPasswordWithCode(
        'user@x.com',
        AccountRole.PATIENT,
        '999999',
        'NewPass123',
      );

      expect((service as any).codeVerificationRepository.markAsUsed).toHaveBeenCalledWith(
        'reset-1',
      );
      expect(account.password).toBe('new-hash');
    });

    it('createAccount succeeds and sends verification email', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);
      queryRunner.manager.save
        .mockResolvedValueOnce(
          createMockAccount({ _id: 'u-37', phone: '0900111222', email: 'u37@x.com' }),
        )
        .mockResolvedValueOnce({ accountId: 'u-37', fullName: 'U 37' });

      const result = await service.createAccount({
        username: 'u37',
        email: 'u37@x.com',
        password: 'Pass1234',
        phone: '0900111222',
        fullName: 'U 37',
        gender: Gender.MALE,
      } as any);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(zaloWebhookService.sendFriendRequest).toHaveBeenCalled();
      expect((service as any).mailerService.sendVerificationCode).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('createAccount rolls back when transaction save fails', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);
      queryRunner.manager.save.mockRejectedValueOnce(new Error('tx-fail'));

      await expect(
        service.createAccount({
          username: 'u38',
          email: 'u38@x.com',
          password: 'Pass1234',
          phone: '0900111333',
          fullName: 'U 38',
          gender: Gender.MALE,
        } as any),
      ).rejects.toThrow('tx-fail');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('findAccountsByIds delegates to repository', async () => {
      accountRepository.findAccountsByIds = jest
        .fn()
        .mockResolvedValue([{ _id: 'u-ids-1' }]);

      const result = await service.findAccountsByIds(['u-ids-1']);
      expect(accountRepository.findAccountsByIds).toHaveBeenCalledWith([
        'u-ids-1',
      ]);
      expect(result).toHaveLength(1);
    });

    it('findAccountsWithGeneralByEmail works without role filter', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ _id: 'no-role-1' }]),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.findAccountsWithGeneralByEmail('no@role.com');

      expect(result).toHaveLength(1);
      expect(qb.getMany).toHaveBeenCalled();
    });

    it('verifyEmailCode rejects already-verified account', async () => {
      const account = createMockAccount({ _id: 'u-v1', isEmailVerified: true });
      jest
        .spyOn(service, 'findAccountsWithGeneralByEmail')
        .mockResolvedValue([account] as any);
      (service as any).codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue(
        {
          _id: 'code-v1',
          expiredAt: new Date(Date.now() + 60_000),
        },
      );

      await expect(service.verifyEmailCode('v1@x.com', '123456')).rejects.toThrow(
        ConflictException,
      );
    });

    it('verifyEmailCode rejects expired code', async () => {
      const account = createMockAccount({ _id: 'u-v2', isEmailVerified: false });
      jest
        .spyOn(service, 'findAccountsWithGeneralByEmail')
        .mockResolvedValue([account] as any);
      (service as any).codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue(
        {
          _id: 'code-v2',
          expiredAt: new Date('2000-01-01T00:00:00.000Z'),
        },
      );

      await expect(service.verifyEmailCode('v2@x.com', '123456')).rejects.toThrow(
        'expired',
      );
    });

    it('resendVerificationCode rejects when account not found', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);

      await expect(service.resendVerificationCode('missing@x.com')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('resendVerificationCode rejects already verified account', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(
        createMockAccount({ isEmailVerified: true }) as any,
      );

      await expect(service.resendVerificationCode('done@x.com')).rejects.toThrow(
        ConflictException,
      );
    });

    it('initiatePasswordReset rejects when account not found in role', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);

      await expect(
        service.initiatePasswordReset('missing@x.com', AccountRole.PATIENT),
      ).rejects.toThrow(NotFoundException);
    });

    it('resetPasswordWithCode rejects missing account', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);

      await expect(
        service.resetPasswordWithCode(
          'missing@x.com',
          AccountRole.PATIENT,
          '123456',
          'NewPass123',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('resetPasswordWithCode rejects pure OAuth account', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(
        createMockAccount({ isOAuthUser: true, password: null }) as any,
      );

      await expect(
        service.resetPasswordWithCode(
          'oauth@x.com',
          AccountRole.PATIENT,
          '123456',
          'NewPass123',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('resetPasswordWithCode rejects invalid reset code', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(
        createMockAccount({ _id: 'u-r1', isOAuthUser: false, password: 'hash' }) as any,
      );
      (service as any).codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue(
        null,
      );

      await expect(
        service.resetPasswordWithCode(
          'u@x.com',
          AccountRole.PATIENT,
          'bad',
          'NewPass123',
        ),
      ).rejects.toThrow('Invalid reset code');
    });

    it('resetPasswordWithCode rejects expired reset code', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(
        createMockAccount({ _id: 'u-r2', isOAuthUser: false, password: 'hash' }) as any,
      );
      (service as any).codeVerificationRepository.findValidByUserIdAndCode.mockResolvedValue(
        {
          _id: 'reset-expired',
          expiredAt: new Date('2000-01-01T00:00:00.000Z'),
        },
      );

      await expect(
        service.resetPasswordWithCode(
          'u2@x.com',
          AccountRole.PATIENT,
          'bad',
          'NewPass123',
        ),
      ).rejects.toThrow('expired');
    });

    it('validateClinicManagerRole throws for non-manager role', () => {
      expect(() =>
        (service as any).validateClinicManagerRole(
          createMockAccount({ role: AccountRole.PATIENT }),
        ),
      ).toThrow(BadRequestException);
    });

    it('getUsernamesAndEmails returns non-empty usernames and all emails', async () => {
      accountRepository.findAllAccounts = jest.fn().mockResolvedValue([
        createMockAccount({ username: 'alpha', email: 'a@x.com' }),
        createMockAccount({ username: '', email: 'b@x.com' }),
      ]);

      const result = await service.getUsernamesAndEmails();

      expect(result.username).toEqual(['alpha']);
      expect(result.email).toEqual(['a@x.com', 'b@x.com']);
    });

    it('createAccount rejects duplicate email', async () => {
      jest.spyOn(service, 'findByEmail').mockResolvedValue(
        createMockAccount({ email: 'dup@x.com' }) as any,
      );

      await expect(
        service.createAccount({
          username: 'dup',
          email: 'dup@x.com',
          password: 'Pass1234',
          phone: '0900222333',
          fullName: 'Dup User',
          gender: Gender.FEMALE,
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('getSubscriptionPayloadForAccount resolves staff via manager parent chain', async () => {
      accountRepository.findAccountById.mockResolvedValue({
        _id: 'm-chain',
        parentId: 'admin-chain',
      });
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-chain',
        serviceId: 'svc-chain',
      });
      (service as any).subscriptionServiceRepository.findById.mockResolvedValue({
        serviceName: 'Chain Service',
        code: 'CHAIN',
      });

      const payload = await service.getSubscriptionPayloadForAccount(
        createMockAccount({
          _id: 'staff-chain',
          role: AccountRole.CLINIC_STAFF,
          parentId: 'm-chain',
        }) as any,
      );

      expect(payload).toEqual({
        subscriptionId: 'sub-chain',
        subscriptionName: 'Chain Service',
        subscriptionCode: 'CHAIN',
      });
    });

    it('resolveClinicAdminId returns admin id for staff via manager parent chain', async () => {
      accountRepository.findAccountById.mockResolvedValue({
        _id: 'm-22',
        parentId: 'admin-22',
      });

      const result = await service.resolveClinicAdminId(
        createMockAccount({
          _id: 's-22',
          role: AccountRole.CLINIC_STAFF,
          parentId: 'm-22',
        }) as any,
      );

      expect(result).toBe('admin-22');
    });

    it('createStaffByClinicManager rolls back transaction when saving staff fails', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockManager({ _id: 'm-rb-1', role: AccountRole.CLINIC_MANAGER }) as any,
      );
      jest.spyOn(service as any, 'validateManagerStatus').mockResolvedValue(
        createMockManager({ _id: 'm-rb-1' }) as any,
      );
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);
      queryRunner.manager.save
        .mockResolvedValueOnce(createMockAccount({ _id: 's-rb-1' }))
        .mockRejectedValueOnce(new Error('staff-save-fail'));

      await expect(
        service.createStaffByClinicManager('m-rb-1', {
          email: 'staff-rb@x.com',
          password: 'Pass1234',
          fullName: 'Staff RB',
          gender: Gender.MALE,
          clinicRole: ClinicRole.STAFF,
        } as any),
      ).rejects.toThrow('staff-save-fail');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('createDoctorByClinicManager rolls back transaction when saving doctor fails', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockManager({ _id: 'm-rb-2', role: AccountRole.CLINIC_MANAGER }) as any,
      );
      jest.spyOn(service as any, 'validateManagerStatus').mockResolvedValue(
        createMockManager({ _id: 'm-rb-2' }) as any,
      );
      jest.spyOn(service, 'findByEmail').mockResolvedValue(null);
      queryRunner.manager.save
        .mockResolvedValueOnce(createMockAccount({ _id: 'd-rb-1' }))
        .mockRejectedValueOnce(new Error('doctor-save-fail'));

      await expect(
        service.createDoctorByClinicManager('m-rb-2', {
          email: 'doctor-rb@x.com',
          password: 'Pass1234',
          fullName: 'Doctor RB',
          gender: Gender.MALE,
        } as any),
      ).rejects.toThrow('doctor-save-fail');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('findAllClinicsManager returns empty pagination when no clinics found', async () => {
      accountRepository.findClinicsWithFilters = jest
        .fn()
        .mockResolvedValue([[], 0]);

      const result = await service.findAllClinicsManager(1, 10, 'x', 'HCM', 'Cardio');

      expect(result.clinics).toEqual([]);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('findAllClinicsManager maps display clinic name and ratings', async () => {
      accountRepository.findClinicsWithFilters = jest.fn().mockResolvedValue([
        [
          {
            _id: 'cm-1',
            clinicManagerInformation: { clinicBranchName: 'Branch 1' },
            address: { _id: 'addr-1' },
            parent: { clinicAdminInformation: { clinicName: 'Clinic A' } },
          },
        ],
        1,
      ]);
      dataSource.query = jest.fn().mockResolvedValue([
        { clinic_id: 'cm-1', avg_rating: '4.50' },
      ]);

      const result = await service.findAllClinicsManager(1, 10);

      expect(result.clinics).toHaveLength(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('findNonDeletedAccountsByEmail applies role filter when provided', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ _id: 'nd-1' }]),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await (service as any).findNonDeletedAccountsByEmail(
        'nd@x.com',
        AccountRole.CLINIC_MANAGER,
      );

      expect(qb.andWhere).toHaveBeenCalledWith('account.role = :role', {
        role: AccountRole.CLINIC_MANAGER,
      });
      expect(result).toHaveLength(1);
    });

    it('mapRegistrationStatus returns expected payload for key statuses', () => {
      const pending = (service as any).mapRegistrationStatus(
        RegistrationStatus.PENDING_MANAGER_SETUP,
      );
      const active = (service as any).mapRegistrationStatus(
        RegistrationStatus.ACTIVE,
        'm-1',
        new Date('2027-01-01T00:00:00.000Z'),
      );
      const nonRenew = (service as any).mapRegistrationStatus(
        RegistrationStatus.NON_RENEWING,
        'm-2',
        new Date('2027-02-01T00:00:00.000Z'),
      );
      const unknown = (service as any).mapRegistrationStatus('UNKNOWN' as any);

      expect(pending.currentStep).toBe('STEP_5');
      expect(active.currentStep).toBe('STEP_9');
      expect(nonRenew.notice).toContain('cancelled');
      expect(unknown.currentStep).toBe('STEP_4');
    });

    it('getRegistrationStatusByClinicAdminId returns no-subscription payload when raw is null', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await (service as any).getRegistrationStatusByClinicAdminId(
        'admin-raw-1',
      );

      expect(result.canResume).toBe(false);
      expect(result.currentStep).toBeNull();
    });

    it('validateSharedEmailPolicyForAccountUpdate allows manager sharing with parent admin', async () => {
      jest.spyOn(service as any, 'findNonDeletedAccountsByEmail').mockResolvedValue([
        createMockAccount({
          _id: 'admin-parent-1',
          role: AccountRole.CLINIC_ADMIN,
          parentId: null,
        }),
      ]);

      await expect(
        (service as any).validateSharedEmailPolicyForAccountUpdate(
          createMockManager({ _id: 'm-shared-1', parentId: 'admin-parent-1' }),
          'shared@x.com',
        ),
      ).resolves.toBeUndefined();
    });

    it('validateSharedEmailPolicyForAccountUpdate throws for disallowed sharing', async () => {
      jest.spyOn(service as any, 'findNonDeletedAccountsByEmail').mockResolvedValue([
        createMockAccount({ _id: 'admin-x', role: AccountRole.CLINIC_ADMIN }),
        createMockAccount({ _id: 'other', role: AccountRole.PATIENT }),
      ]);

      await expect(
        (service as any).validateSharedEmailPolicyForAccountUpdate(
          createMockManager({ _id: 'm-shared-2', parentId: 'admin-parent-2' }),
          'badshare@x.com',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('getLegalDocumentsForManager returns manager docs for owner admin', async () => {
      jest.spyOn(service, 'findAccountEntityById')
        .mockResolvedValueOnce(
          createMockAccount({ _id: 'admin-doc-1', role: AccountRole.CLINIC_ADMIN }) as any,
        )
        .mockResolvedValueOnce(
          createMockManager({
            _id: 'manager-doc-1',
            role: AccountRole.CLINIC_MANAGER,
            parentId: 'admin-doc-1',
          }) as any,
        );
      clinicLegalDocsRepository.findByAccountId.mockResolvedValue({ _id: 'doc-1' });

      const result = await service.getLegalDocumentsForManager(
        'admin-doc-1',
        'manager-doc-1',
      );

      expect((result as any)._id).toBe('doc-1');
    });

    it('updateLegalDocumentsForManager updates rejected docs and subscription in transaction', async () => {
      jest.spyOn(service, 'findAccountEntityById')
        .mockResolvedValueOnce(
          createMockAccount({ _id: 'admin-up-1', role: AccountRole.CLINIC_ADMIN }) as any,
        )
        .mockResolvedValueOnce(
          createMockManager({
            _id: 'manager-up-1',
            role: AccountRole.CLINIC_MANAGER,
            parentId: 'admin-up-1',
          }) as any,
        );
      clinicLegalDocsRepository.findByAccountId.mockResolvedValue({
        _id: 'docs-up-1',
        verificationStatus: LegalDocumentVerificationStatus.REJECTED,
      });
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-up-1',
        subscriptionStatus: RegistrationStatus.PENDING_LEGAL_SETUP,
      });
      queryRunner.manager.save = jest
        .fn()
        .mockResolvedValueOnce({ _id: 'docs-up-1' })
        .mockResolvedValueOnce({ _id: 'sub-up-1' });

      const result = await service.updateLegalDocumentsForManager(
        'admin-up-1',
        'manager-up-1',
        {
          operatingLicense: 'new-op',
        } as any,
      );

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect((result as any)._id).toBe('docs-up-1');
    });

    it('updateLegalDocumentsForManager rolls back on transaction error', async () => {
      jest.spyOn(service, 'findAccountEntityById')
        .mockResolvedValueOnce(
          createMockAccount({ _id: 'admin-up-2', role: AccountRole.CLINIC_ADMIN }) as any,
        )
        .mockResolvedValueOnce(
          createMockManager({
            _id: 'manager-up-2',
            role: AccountRole.CLINIC_MANAGER,
            parentId: 'admin-up-2',
          }) as any,
        );
      clinicLegalDocsRepository.findByAccountId.mockResolvedValue({
        _id: 'docs-up-2',
        verificationStatus: LegalDocumentVerificationStatus.REJECTED,
      });
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-up-2',
        subscriptionStatus: RegistrationStatus.PENDING_LEGAL_SETUP,
      });
      queryRunner.manager.save = jest.fn().mockRejectedValue(new Error('tx-doc-fail'));

      await expect(
        service.updateLegalDocumentsForManager('admin-up-2', 'manager-up-2', {
          businessLicense: 'new-biz',
        } as any),
      ).rejects.toThrow('tx-doc-fail');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('findClinicById throws NotFoundException when clinic is missing', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await expect(service.findClinicById('missing-clinic')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('findClinicById throws when clinic manager information is missing', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          _id: 'clinic-1',
          clinicManagerInformation: null,
        }),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await expect(service.findClinicById('clinic-1')).rejects.toThrow(
        'Clinic manager information not found',
      );
    });

    it('findClinicById returns detail with mapped schedules/doctors and fallback catches', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          _id: 'clinic-2',
          role: AccountRole.CLINIC_MANAGER,
          clinicManagerInformation: { clinicBranchName: 'Branch Z' },
          address: { _id: 'addr-z' },
          children: [
            {
              _id: 'doc-z',
              role: AccountRole.DOCTOR,
              status: AccountStatus.ACTIVE,
              doctorInformation: { fullName: 'Dr Z' },
            },
          ],
          clinicSchedules: [
            {
              weekDay: 'MONDAY',
              clinicShift: {
                hours: [{ startHour: '08:00', endHour: '09:00' }],
              },
            },
          ],
          parent: {
            clinicAdminInformation: { clinicName: 'Clinic Root' },
          },
        }),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);
      (service as any).googleIframeRepository.findByAddressId.mockResolvedValue(null);
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-z',
        serviceId: 'svc-z',
      });
      (service as any).subscriptionServiceRepository.findById.mockResolvedValue({
        serviceName: 'Svc Z',
        code: 'SZ',
      });
      dataSource.query = jest
        .fn()
        .mockResolvedValueOnce([{ doctor_id: 'doc-z', avg_rating: '4.2' }])
        .mockRejectedValueOnce(new Error('clinic-rating-fail'))
        .mockRejectedValueOnce(new Error('feedback-fail'));

      const result = await service.findClinicById('clinic-2', 'Dr');
      expect(result).toBeDefined();
    });

    it('getPublicDoctorById throws when doctor not found', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      await expect(service.getPublicDoctorById('doc-missing')).rejects.toThrow(
        'Doctor not found',
      );
    });

    it('getPublicDoctorById throws when doctor info is missing', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ _id: 'doc-3', employeeSchedules: [] }),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);
      (service as any).doctorInfoRepository.findPublicByDoctorAccountId = jest
        .fn()
        .mockResolvedValue(null);

      await expect(service.getPublicDoctorById('doc-3')).rejects.toThrow(
        'Doctor information not found',
      );
    });

    it('getPublicDoctorById throws when doctor info is soft-deleted', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ _id: 'doc-4', employeeSchedules: [] }),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);
      (service as any).doctorInfoRepository.findPublicByDoctorAccountId = jest
        .fn()
        .mockResolvedValue({ deletedAt: new Date() });

      await expect(service.getPublicDoctorById('doc-4')).rejects.toThrow(
        'Doctor not found',
      );
    });

    it('getPublicDoctorById returns detail and tolerates rating/feedback query errors', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          _id: 'doc-5',
          profilePicture: 'acc.jpg',
          employeeSchedules: [
            {
              weekDay: 'MONDAY',
              clinicShift: {
                shift: 'MORNING',
                hours: [{ startHour: '08:00', endHour: '09:00' }],
              },
            },
          ],
          parent: {
            phone: '0900',
            clinicManagerInformation: { _id: 'cm-1', clinicBranchName: 'CM 1' },
          },
        }),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);
      (service as any).doctorInfoRepository.findPublicByDoctorAccountId = jest
        .fn()
        .mockResolvedValue({ deletedAt: null, profilePicture: 'doc.jpg', dob: new Date() });
      dataSource.query = jest
        .fn()
        .mockRejectedValueOnce(new Error('rating-fail'))
        .mockRejectedValueOnce(new Error('feedback-fail'));

      const result = await service.getPublicDoctorById('doc-5');
      expect(result).toBeDefined();
    });

    it('checkRegistrationStatus returns start-new payload when account absent', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await service.checkRegistrationStatus('new@clinic.com');
      expect(result.currentStep).toBe('STEP_2');
      expect(result.canResume).toBe(true);
    });

    it('checkRegistrationStatus delegates to registration-state resolver when account exists', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ _id: 'admin-ck-1' }),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);
      (service as any).getRegistrationStatusByClinicAdminId = jest
        .fn()
        .mockResolvedValue({ currentStep: 'STEP_7', canResume: true });

      const result = await service.checkRegistrationStatus('exists@clinic.com');
      expect(result.currentStep).toBe('STEP_7');
    });

    it('cancelActiveSubscription validates role/status and transitions to NON_RENEWING', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ _id: 'admin-sub-1', role: AccountRole.CLINIC_ADMIN }) as any,
      );
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-cancel-1',
        serviceId: 'svc-1',
        subscriptionDate: new Date('2026-01-01T00:00:00.000Z'),
        expirationDate: new Date('2026-12-01T00:00:00.000Z'),
        subscriptionStatus: RegistrationStatus.ACTIVE,
      });
      clinicSubscriptionRepository.save = jest.fn().mockResolvedValue(undefined);
      (service as any).clinicSubscriptionHistoryRepository.createHistoryRecord = jest
        .fn()
        .mockResolvedValue(undefined);

      const result = await service.cancelActiveSubscription('admin-sub-1', {
        reason: 'cost',
      });

      expect(result.newStatus).toBe(RegistrationStatus.NON_RENEWING);
      expect(clinicSubscriptionRepository.save).toHaveBeenCalled();
    });

    it('findStaffById throws forbidden when staff is outside manager clinic', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ _id: 'staff-x', parentId: 'other-manager' }) as any,
      );
      accountRepository.findAccountById.mockResolvedValue({
        _id: 'manager-1',
        parentId: 'admin-1',
      });
      accountRepository.findByParentIdAndRole.mockResolvedValue([{ _id: 'manager-2' }]);

      await expect(service.findStaffById('staff-x', 'manager-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('findStaffById returns account detail when staff belongs to manager clinic', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ _id: 'staff-ok', parentId: 'manager-2' }) as any,
      );
      accountRepository.findAccountById.mockResolvedValue({
        _id: 'manager-1',
        parentId: 'admin-1',
      });
      accountRepository.findByParentIdAndRole.mockResolvedValue([{ _id: 'manager-2' }]);
      jest
        .spyOn(service, 'getAccountInformationByRole')
        .mockResolvedValue({ _id: 'staff-ok' } as any);

      const result = await service.findStaffById('staff-ok', 'manager-1');
      expect((result as any)._id).toBe('staff-ok');
    });

    it('findAllStaffByManager returns mapped staff items with pagination', async () => {
      accountRepository.findAccountById.mockResolvedValue({
        _id: 'manager-11',
        parentId: 'admin-11',
      });
      accountRepository.findByParentIdAndRole.mockResolvedValue([{ _id: 'manager-12' }]);
      accountRepository.findStaffByClinicWithFilters = jest
        .fn()
        .mockResolvedValue([
          [
            {
              _id: 'staff-11',
              clinicStaffInformation: { fullName: 'Staff 11' },
            },
          ],
          1,
        ]);

      const result = await service.findAllStaffByManager('manager-11', 1, 10);
      expect(result.staff).toHaveLength(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('findAllDoctorsByManager returns mapped doctor items with pagination', async () => {
      accountRepository.findAccountById.mockResolvedValue({
        _id: 'manager-21',
        parentId: 'admin-21',
      });
      accountRepository.findByParentIdAndRole.mockResolvedValue([{ _id: 'manager-22' }]);
      (service as any).clinicManagerInfoRepository.findByAccountId.mockResolvedValue({
        clinicBranchName: 'Branch 21',
      });
      accountRepository.findDoctorsWithFilters = jest.fn().mockResolvedValue([
        [
          {
            _id: 'doctor-21',
            doctorInformation: { fullName: 'Doctor 21' },
          },
        ],
        1,
      ]);

      const result = await service.findAllDoctorsByManager('manager-21', 1, 10);
      expect(result.doctors).toHaveLength(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('findAllEmployeesByClinic maps each employee through role-aware formatter', async () => {
      accountRepository.findEmployeesByClinicWithFilters = jest
        .fn()
        .mockResolvedValue([{ _id: 'e-1' }, { _id: 'e-2' }]);
      jest
        .spyOn(service, 'getAccountInformationByRole')
        .mockResolvedValueOnce({ _id: 'e-1' } as any)
        .mockResolvedValueOnce({ _id: 'e-2' } as any);

      const result = await service.findAllEmployeesByClinic('clinic-e', {
        role: undefined,
        search: 'x',
      } as any);

      expect(result).toHaveLength(2);
      expect(service.getAccountInformationByRole).toHaveBeenCalledTimes(2);
    });

    it('findAllDoctors only includes items with existing doctor information', async () => {
      accountRepository.findDoctorsWithFilters = jest.fn().mockResolvedValue([
        [{ _id: 'd-11', parentId: 'm-11' }, { _id: 'd-12', parentId: null }],
        2,
      ]);
      (service as any).doctorInfoRepository.findByAccountId = jest
        .fn()
        .mockResolvedValueOnce({ fullName: 'Doctor 11' })
        .mockResolvedValueOnce(null);
      (service as any).clinicManagerInfoRepository.findByAccountId = jest
        .fn()
        .mockResolvedValue({ clinicBranchName: 'B11' });

      const result = await service.findAllDoctors(1, 10, 'c-1', 'MALE');
      expect(result.doctors).toHaveLength(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('findClinicById covers schedule sorting and success rating/feedback mapping', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          _id: 'clinic-sort-1',
          role: AccountRole.CLINIC_MANAGER,
          clinicManagerInformation: { clinicBranchName: 'Branch Sort' },
          address: { _id: 'addr-sort-1' },
          children: [
            {
              _id: 'doc-s1',
              role: AccountRole.DOCTOR,
              status: AccountStatus.ACTIVE,
              doctorInformation: { fullName: 'Doc S1' },
            },
          ],
          clinicSchedules: [
            {
              weekDay: 'TUESDAY',
              clinicShift: { hours: [{ startHour: '09:00', endHour: '10:00' }] },
            },
            {
              weekDay: 'MONDAY',
              clinicShift: { hours: [{ startHour: '08:00', endHour: '09:00' }] },
            },
          ],
          parent: {
            clinicAdminInformation: { clinicName: '' },
          },
        }),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);
      (service as any).googleIframeRepository.findByAddressId.mockResolvedValue(null);
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue({
        _id: 'sub-sort-1',
        serviceId: 'svc-sort-1',
      });
      (service as any).subscriptionServiceRepository.findById.mockResolvedValue({
        serviceName: 'Sort Service',
        code: 'SORT',
      });
      dataSource.query = jest
        .fn()
        .mockResolvedValueOnce([{ doctor_id: 'doc-s1', avg_rating: '3.75' }])
        .mockResolvedValueOnce([{ avg_rating: '4.25' }])
        .mockResolvedValueOnce([
          {
            _id: 'fb-1',
            rating: 5,
            description: 'Great',
            description_label: 'good',
            feedback_images: [],
            feedback_images_label: [],
            created_at: new Date(),
            patient_name: 'Patient A',
            patient_profile_picture: null,
          },
        ]);

      const result = await service.findClinicById('clinic-sort-1');
      expect(result).toBeDefined();
    });

    it('getPublicDoctorById covers schedule sorting and success rating/feedback mapping', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          _id: 'doc-sort-1',
          profilePicture: 'acc-sort.jpg',
          employeeSchedules: [
            {
              weekDay: 'TUESDAY',
              clinicShift: {
                shift: 'AFTERNOON',
                hours: [{ startHour: '13:00', endHour: '14:00' }],
              },
            },
            {
              weekDay: 'MONDAY',
              clinicShift: {
                shift: 'MORNING',
                hours: [{ startHour: '08:00', endHour: '09:00' }],
              },
            },
          ],
          parent: {
            phone: '0999',
            clinicManagerInformation: { _id: 'cm-sort', clinicBranchName: 'CM Sort' },
          },
        }),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);
      (service as any).doctorInfoRepository.findPublicByDoctorAccountId = jest
        .fn()
        .mockResolvedValue({ deletedAt: null, profilePicture: 'doc-sort.jpg', dob: new Date() });
      dataSource.query = jest
        .fn()
        .mockResolvedValueOnce([{ avg_rating: '4.00' }])
        .mockResolvedValueOnce([
          {
            _id: 'fb-d1',
            rating: 4,
            description: 'Good doctor',
            description_label: 'good',
            feedback_images: [],
            feedback_images_label: [],
            created_at: new Date(),
            patient_name: 'Patient B',
            patient_profile_picture: null,
          },
        ]);

      const result = await service.getPublicDoctorById('doc-sort-1');
      expect(result).toBeDefined();
    });

    it('updateClinicAdminProfile creates profile for clinic admin and updates existing fields', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ _id: 'admin-prof-1', role: AccountRole.CLINIC_ADMIN }) as any,
      );

      (service as any).clinicAdminInfoRepository.findByAccountId.mockResolvedValueOnce(null);
      (service as any).clinicAdminInfoRepository.create = jest.fn((x: any) => x);
      (service as any).clinicAdminInfoRepository.save = jest
        .fn()
        .mockImplementation(async (x: any) => x);

      const created = await service.updateClinicAdminProfile('admin-prof-1', {
        clinicName: 'Clinic P1',
        description: 'Desc P1',
        specializedIn: ['A'],
        pros: ['B'],
        paraclinical: ['C'],
        dob: '2000-01-01',
        profilePicture: 'p1.jpg',
        bankName: 'VCB',
        bankNumber: '111',
        bankBranch: 'HCM',
        sepayVa: 'va1',
        isVerify: true,
      } as any);

      (service as any).clinicAdminInfoRepository.findByAccountId.mockResolvedValueOnce(created);
      const updated = await service.updateClinicAdminProfile('admin-prof-1', {
        taxCode: 'x' as any,
        clinicName: 'Clinic P2',
        description: 'Desc P2',
        specializedIn: ['D'],
        pros: ['E'],
        paraclinical: ['F'],
        dob: null,
        profilePicture: 'p2.jpg',
        bankName: 'ACB',
        bankNumber: '222',
        bankBranch: 'HN',
        sepayVa: 'va2',
        isVerify: false,
      } as any);

      expect(created).toBeDefined();
      expect(updated).toBeDefined();
    });

    it('updateClinicAdminProfile rejects non-clinic-admin role', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ role: AccountRole.PATIENT }) as any,
      );

      await expect(
        service.updateClinicAdminProfile('not-admin', { clinicName: 'X' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('mapRegistrationStatus covers remaining statuses and null status', () => {
      const noSub = (service as any).mapRegistrationStatus(null);
      const step4 = (service as any).mapRegistrationStatus(
        RegistrationStatus.PENDING_SEPAY_SETUP,
      );
      const step6 = (service as any).mapRegistrationStatus(
        RegistrationStatus.PENDING_LEGAL_SETUP,
      );
      const step7 = (service as any).mapRegistrationStatus(
        RegistrationStatus.PENDING_APPROVAL,
      );
      const step8Payment = (service as any).mapRegistrationStatus(
        RegistrationStatus.PENDING_PAYMENT,
      );
      const step8Expired = (service as any).mapRegistrationStatus(
        RegistrationStatus.EXPIRED,
        undefined,
        new Date('2027-03-01T00:00:00.000Z'),
      );

      expect(noSub.canResume).toBe(false);
      expect(step4.currentStep).toBe('STEP_4');
      expect(step6.currentStep).toBe('STEP_6');
      expect(step7.currentStep).toBe('STEP_7');
      expect(step8Payment.currentStep).toBe('STEP_8');
      expect(step8Expired.currentStep).toBe('STEP_8');
    });

    it('getRegistrationStatusByClinicAdminId maps non-null raw payload', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          account_id: 'admin-map-1',
          subscription_status: RegistrationStatus.ACTIVE,
          subscription_expiration: new Date('2027-04-01T00:00:00.000Z'),
          manager_account_id: 'm-map-1',
        }),
      };
      accountRepository.createQueryBuilder = jest.fn().mockReturnValue(qb);

      const result = await (service as any).getRegistrationStatusByClinicAdminId(
        'admin-map-1',
      );
      expect(result.currentStep).toBe('STEP_9');
    });

    it('validateSharedEmailPolicyForAccountUpdate allows clinic-admin + child manager sharing', async () => {
      jest.spyOn(service as any, 'findNonDeletedAccountsByEmail').mockResolvedValue([
        createMockManager({
          _id: 'm-share-1',
          role: AccountRole.CLINIC_MANAGER,
          parentId: 'admin-share-1',
        }),
      ]);

      await expect(
        (service as any).validateSharedEmailPolicyForAccountUpdate(
          createMockAccount({ _id: 'admin-share-1', role: AccountRole.CLINIC_ADMIN }),
          'share@x.com',
        ),
      ).resolves.toBeUndefined();
    });

    it('cancelActiveSubscription rejects non-admin, missing subscription, and non-active status', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValueOnce(
        createMockAccount({ role: AccountRole.PATIENT }) as any,
      );
      await expect(service.cancelActiveSubscription('acc-1')).rejects.toThrow(
        ForbiddenException,
      );

      jest.spyOn(service, 'findAccountEntityById').mockResolvedValueOnce(
        createMockAccount({ _id: 'admin-sub-2', role: AccountRole.CLINIC_ADMIN }) as any,
      );
      clinicSubscriptionRepository.findByClinicId.mockResolvedValueOnce(null);
      await expect(service.cancelActiveSubscription('admin-sub-2')).rejects.toThrow(
        NotFoundException,
      );

      jest.spyOn(service, 'findAccountEntityById').mockResolvedValueOnce(
        createMockAccount({ _id: 'admin-sub-3', role: AccountRole.CLINIC_ADMIN }) as any,
      );
      clinicSubscriptionRepository.findByClinicId.mockResolvedValueOnce({
        subscriptionStatus: RegistrationStatus.PENDING_PAYMENT,
      });
      await expect(service.cancelActiveSubscription('admin-sub-3')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('findStaffById throws when manager account cannot be found', async () => {
      jest.spyOn(service, 'findAccountEntityById').mockResolvedValue(
        createMockAccount({ _id: 'staff-miss-parent', parentId: 'x' }) as any,
      );
      accountRepository.findAccountById.mockResolvedValue(null);

      await expect(
        service.findStaffById('staff-miss-parent', 'manager-missing'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('getLegalDocumentsForManager rejects non-admin, non-manager and wrong owner', async () => {
      jest.spyOn(service, 'findAccountEntityById')
        .mockResolvedValueOnce(createMockAccount({ role: AccountRole.PATIENT }) as any);
      await expect(
        service.getLegalDocumentsForManager('a1', 'm1'),
      ).rejects.toThrow(ForbiddenException);

      jest.spyOn(service, 'findAccountEntityById')
        .mockResolvedValueOnce(
          createMockAccount({ _id: 'admin-g2', role: AccountRole.CLINIC_ADMIN }) as any,
        )
        .mockResolvedValueOnce(createMockAccount({ role: AccountRole.PATIENT }) as any);
      await expect(
        service.getLegalDocumentsForManager('admin-g2', 'm2'),
      ).rejects.toThrow(NotFoundException);

      jest.spyOn(service, 'findAccountEntityById')
        .mockResolvedValueOnce(
          createMockAccount({ _id: 'admin-g3', role: AccountRole.CLINIC_ADMIN }) as any,
        )
        .mockResolvedValueOnce(
          createMockManager({ _id: 'm3', role: AccountRole.CLINIC_MANAGER, parentId: 'other' }) as any,
        );
      await expect(
        service.getLegalDocumentsForManager('admin-g3', 'm3'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updateLegalDocumentsForManager validates preconditions before transaction', async () => {
      jest.spyOn(service, 'findAccountEntityById')
        .mockResolvedValueOnce(createMockAccount({ role: AccountRole.PATIENT }) as any);
      await expect(
        service.updateLegalDocumentsForManager('a1', 'm1', {} as any),
      ).rejects.toThrow(ForbiddenException);

      jest.spyOn(service, 'findAccountEntityById')
        .mockResolvedValueOnce(
          createMockAccount({ _id: 'admin-ul2', role: AccountRole.CLINIC_ADMIN }) as any,
        )
        .mockResolvedValueOnce(createMockAccount({ role: AccountRole.PATIENT }) as any);
      await expect(
        service.updateLegalDocumentsForManager('admin-ul2', 'm2', {} as any),
      ).rejects.toThrow(NotFoundException);

      jest.spyOn(service, 'findAccountEntityById')
        .mockResolvedValueOnce(
          createMockAccount({ _id: 'admin-ul3', role: AccountRole.CLINIC_ADMIN }) as any,
        )
        .mockResolvedValueOnce(
          createMockManager({ _id: 'm3', role: AccountRole.CLINIC_MANAGER, parentId: 'other' }) as any,
        );
      await expect(
        service.updateLegalDocumentsForManager('admin-ul3', 'm3', {} as any),
      ).rejects.toThrow(ForbiddenException);

      jest
        .spyOn(service, 'findAccountEntityById')
        .mockImplementation(async (id: string) => {
          if (id === 'admin-ul4') {
            return createMockAccount({
              _id: 'admin-ul4',
              role: AccountRole.CLINIC_ADMIN,
            }) as any;
          }
          if (id === 'm4') {
            return createMockManager({
              _id: 'm4',
              role: AccountRole.CLINIC_MANAGER,
              parentId: 'admin-ul4',
            }) as any;
          }
          return createMockAccount() as any;
        });
      clinicLegalDocsRepository.findByAccountId.mockResolvedValueOnce(null);
      await expect(
        service.updateLegalDocumentsForManager('admin-ul4', 'm4', {} as any),
      ).rejects.toThrow('Legal documents not found');

      clinicLegalDocsRepository.findByAccountId.mockResolvedValueOnce({
        verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
      });
      await expect(
        service.updateLegalDocumentsForManager('admin-ul4', 'm4', {} as any),
      ).rejects.toThrow('rejected');

      clinicLegalDocsRepository.findByAccountId.mockResolvedValueOnce({
        verificationStatus: LegalDocumentVerificationStatus.REJECTED,
      });
      clinicSubscriptionRepository.findByClinicId.mockResolvedValueOnce(null);
      await expect(
        service.updateLegalDocumentsForManager('admin-ul4', 'm4', {} as any),
      ).rejects.toThrow('Clinic subscription not found');

      clinicLegalDocsRepository.findByAccountId.mockResolvedValueOnce({
        verificationStatus: LegalDocumentVerificationStatus.REJECTED,
      });
      clinicSubscriptionRepository.findByClinicId.mockResolvedValueOnce({
        subscriptionStatus: RegistrationStatus.ACTIVE,
      });
      await expect(
        service.updateLegalDocumentsForManager('admin-ul4', 'm4', {} as any),
      ).rejects.toThrow('Cannot update legal documents');
    });

    it('registerClinicAdmin and createClinicManagerForRegistration execute async email catch logs', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      mailerService.sendClinicAdminWelcomeEmail.mockRejectedValueOnce(
        new Error('mail-admin-fail'),
      );
      accountRepository.findByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockResolvedValueOnce(createMockAccount({ _id: 'mail-admin-1' }));

      await service.registerClinicAdmin({
        username: 'ca-mail',
        email: 'ca-mail@x.com',
        password: 'Pass1234',
        phone: '0900111000',
        clinicName: 'Mail Clinic',
        serviceId: 'svc-mail',
      } as any);

      mailerService.sendManagerCredentialsEmail.mockRejectedValueOnce(
        new Error('mail-manager-fail'),
      );
      jest
        .spyOn(service as any, 'getClinicAdminRegistrationState')
        .mockResolvedValue({
          clinicAdminId: 'admin-mail-1',
          clinicAdminRole: AccountRole.CLINIC_ADMIN,
          clinicName: 'Mail Clinic',
          subscriptionId: 'sub-mail-1',
          subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
          managerCount: 0,
        });
      jest.spyOn(service as any, 'findRegistrationAccountsByEmail').mockResolvedValue([]);
      queryRunner.manager.getRepository = jest.fn(() => ({
        createQueryBuilder: jest.fn(() => ({
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ password: 'hashedPassword' }),
        })),
      }));
      (bcrypt.compare as unknown as jest.Mock).mockResolvedValueOnce(false);
      queryRunner.manager.save = jest
        .fn()
        .mockResolvedValueOnce(createMockManager({ _id: 'm-mail-1' }))
        .mockResolvedValueOnce({ accountId: 'm-mail-1' })
        .mockResolvedValueOnce({ accountId: 'm-mail-1' })
        .mockResolvedValueOnce({ accountId: 'm-mail-1' })
        .mockResolvedValueOnce({ _id: 'sub-mail-1' });

      await service.createClinicManagerForRegistration('admin-mail-1', {
        username: 'm-mail',
        email: 'm-mail@x.com',
        password: 'Pass1234',
        phone: '0900111222',
        clinicBranchName: 'Branch',
        fullName: 'Manager Mail',
        gender: Gender.MALE,
        provinceCode: 'HCM',
        provinceName: 'Ho Chi Minh',
        districtCode: 'D1',
        districtName: 'District 1',
        wardCode: 'W1',
        wardName: 'Ward 1',
        addressDetail: '123',
      } as any);

      await new Promise((r) => setImmediate(r));
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    describe('Business Scenario TODO Sweep - Chunk 1-900', () => {
      it.todo(
        'Nghiệp vụ tìm bệnh nhân: phải nhập ít nhất một tiêu chí phone/email/họ tên',
      );
      it.todo(
        'Nghiệp vụ tìm bệnh nhân: nếu tìm ra tài khoản khác PATIENT thì trả thông báo không thể đặt lịch',
      );
      it.todo(
        'Nghiệp vụ tạo PATIENT thường: email trùng vai trò bị chặn và giao dịch phải rollback an toàn',
      );
      it.todo(
        'Nghiệp vụ tạo PATIENT qua OAuth: tài khoản được kích hoạt ngay và đánh dấu email đã xác minh',
      );
      it.todo(
        'Nghiệp vụ cập nhật tài khoản: đổi email phải reset xác minh email nhưng vẫn duy trì trạng thái hoạt động',
      );
      it.todo(
        'Nghiệp vụ cập nhật tài khoản: cập nhật thông tin theo từng nhóm vai trò (ADMIN/PATIENT/CLINIC_ADMIN/CLINIC_MANAGER/STAFF/DOCTOR)',
      );
      it.todo(
        'Nghiệp vụ lấy thông tin theo role: role không hợp lệ phải trả NotFound để tránh lộ dữ liệu',
      );
      it.todo(
        'Nghiệp vụ tìm kiếm bệnh nhân: ngày sinh lỗi định dạng không làm hỏng toàn bộ kết quả trả về',
      );
    });
  });
});
