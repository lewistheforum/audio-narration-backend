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
import { SubscriptionServiceRepository } from '../../../src/modules/subscriptions/repositories/subscription-service.repository';
import { TransactionRepository } from '../../../src/modules/transactions/repositories/transaction.repository';
import { MailerService } from '../../../src/modules/mailer/mailer.service';
import { DataSource } from 'typeorm';
import { AccountRole, AccountStatus } from '../../../src/modules/accounts/enums';
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
  let dataSource: any;
  let queryRunner: any;

  // Mock Data Factories
  const createMockAccount = (overrides = {}) => ({
    _id: 'account-1',
    username: 'testuser',
    email: 'test@example.com',
    password: 'hashedPassword',
    phone: '+84123456789',
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
    phone: '+84987654321',
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
      },
    };

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
    };

    clinicSubscriptionRepository = {
      create: jest.fn().mockReturnValue(createMockClinicSubscription()),
      findByClinicId: jest.fn().mockResolvedValue(createMockClinicSubscription()),
    };

    transactionRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    mailerService = {
      sendClinicAdminWelcomeEmail: jest.fn().mockResolvedValue(true),
      sendManagerCredentialsEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: AccountRepository, useValue: accountRepository },
        { provide: GeneralAccountRepository, useValue: {} },
        { provide: CodeVerificationRepository, useValue: {} },
        { provide: ClinicAdminInformationRepository, useValue: clinicAdminInfoRepository },
        { provide: ClinicManagerInformationRepository, useValue: clinicManagerInfoRepository },
        { provide: ClinicStaffInformationRepository, useValue: { create: jest.fn().mockReturnValue({ accountId: 'staff-1', fullName: 'Staff', clinicRole: ClinicRole.STAFF }) } },
        { provide: DoctorInformationRepository, useValue: { create: jest.fn().mockReturnValue({ accountId: 'doctor-1', fullName: 'Doctor', specialization: 'Cardiology' }) } },
        { provide: ClinicsLegalDocumentsRepository, useValue: clinicLegalDocsRepository },
        { provide: AddressRepository, useValue: addressRepository },
        { provide: GoogleIframeRepository, useValue: {} },
        { provide: ClinicSubscriptionRepository, useValue: clinicSubscriptionRepository },
        { provide: ClinicSubscriptionHistoryRepository, useValue: {} },
        { provide: SubscriptionServiceRepository, useValue: {} },
        { provide: TransactionRepository, useValue: transactionRepository },
        { provide: MailerService, useValue: mailerService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);

    // Mock bcrypt
    jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashedPassword'));
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
      phone: '+84123456789',
      clinicName: 'City Medical Center',
      description: 'Healthcare facility',
      specializedIn: ['Cardiology'],
      pros: ['Expert doctors'],
      paraclinical: ['X-Ray'],
      bankName: 'Vietcombank',
      bankNumber: '1234567890',
      bankBranch: 'HCM Branch',
      sepayVa: '1900123456',
      serviceId: 'service-1',
    };

    it('should successfully create clinic admin with bank details and subscription', async () => {
      // Setup: No existing account
      accountRepository.findByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockResolvedValueOnce(createMockAccount({ _id: 'new-account-1' }));

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

      await expect(service.registerClinicAdmin(validDto)).rejects.toThrow(ConflictException);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should enforce email uniqueness - reject if email used by CLINIC_MANAGER', async () => {
      // Setup: Existing CLINIC_MANAGER with same email
      accountRepository.findAccountByEmail.mockResolvedValue(
        createMockAccount({ role: AccountRole.CLINIC_MANAGER }),
      );

      await expect(service.registerClinicAdmin(validDto)).rejects.toThrow(ConflictException);
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should allow email reuse if existing account has different role (PATIENT)', async () => {
      // Setup: Existing PATIENT with same email
      accountRepository.findAccountByEmail.mockResolvedValue(
        createMockAccount({ role: AccountRole.PATIENT }),
      );
      queryRunner.manager.save.mockResolvedValueOnce(createMockAccount({ _id: 'new-account-1' }));

      const result = await service.registerClinicAdmin(validDto);

      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should hash password before storing', async () => {
      accountRepository.findByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockResolvedValueOnce(createMockAccount());

      await service.registerClinicAdmin(validDto);

      expect(bcrypt.hash).toHaveBeenCalledWith(validDto.password, expect.any(Number));
      expect(accountRepository.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'hashedPassword',
        }),
      );
    });

    it('should rollback transaction on error', async () => {
      accountRepository.findByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockRejectedValue(new Error('Database error'));

      await expect(service.registerClinicAdmin(validDto)).rejects.toThrow('Database error');
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
      phone: '+84987654321',
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
        createMockAccount({ _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN }),
      );
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
        }),
      );
      accountRepository.findByParentIdAndRole.mockResolvedValue([]);
      accountRepository.findByEmail.mockResolvedValue(null);
      queryRunner.manager.save.mockResolvedValue(createMockClinicManager());
    });

    it('should successfully create clinic manager with address', async () => {
      const result = await service.createClinicManagerForRegistration(clinicAdminId, validDto);

      // Assert transaction flow
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();

      // Assert manager account creation
      expect(accountRepository.createAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          username: validDto.username,
          email: validDto.email,
          role: AccountRole.CLINIC_MANAGER,
          status: AccountStatus.ACTIVE,
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
      accountRepository.findAccountById.mockResolvedValue(
        createMockAccount({ role: AccountRole.PATIENT }),
      );

      await expect(
        service.createClinicManagerForRegistration(clinicAdminId, validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if subscription status is not PENDING_MANAGER_SETUP', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.PENDING_LEGAL_SETUP,
        }),
      );

      await expect(
        service.createClinicManagerForRegistration(clinicAdminId, validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if manager already exists', async () => {
      accountRepository.findByParentIdAndRole.mockResolvedValue([createMockClinicManager()]);

      await expect(
        service.createClinicManagerForRegistration(clinicAdminId, validDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject if email already exists', async () => {
      accountRepository.findAccountByEmail.mockResolvedValue(createMockAccount());

      await expect(
        service.createClinicManagerForRegistration(clinicAdminId, validDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should transition subscription status to PENDING_LEGAL_SETUP', async () => {
      const mockSubscription = createMockClinicSubscription({
        subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
      });
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(mockSubscription);

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
        .mockResolvedValueOnce(createMockAccount({ _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN }))
        .mockResolvedValueOnce(
          createMockClinicManager({ _id: managerAccountId, parentId: clinicAdminId }),
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
        .mockResolvedValueOnce(createMockAccount({ _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN }))
        .mockResolvedValueOnce(createMockClinicManager({ _id: managerAccountId, parentId: clinicAdminId }));

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
        service.uploadLegalDocumentsForManager(clinicAdminId, managerAccountId, validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if manager is not CLINIC_MANAGER role', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(createMockAccount({ role: AccountRole.CLINIC_ADMIN }))
        .mockResolvedValueOnce(createMockAccount({ role: AccountRole.PATIENT }));

      await expect(
        service.uploadLegalDocumentsForManager(clinicAdminId, managerAccountId, validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject if manager is not owned by admin (parentId mismatch)', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(createMockAccount({ _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN }))
        .mockResolvedValueOnce(
          createMockClinicManager({ parentId: 'different-admin-id' }),
        );

      await expect(
        service.uploadLegalDocumentsForManager(clinicAdminId, managerAccountId, validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if subscription status is not PENDING_LEGAL_SETUP', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(createMockAccount({ _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN }))
        .mockResolvedValueOnce(createMockClinicManager({ _id: managerAccountId, parentId: clinicAdminId }));
      
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.PENDING_MANAGER_SETUP,
        }),
      );

      await expect(
        service.uploadLegalDocumentsForManager(clinicAdminId, managerAccountId, validDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update existing legal documents if already exist', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(createMockAccount({ _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN }))
        .mockResolvedValueOnce(createMockClinicManager({ _id: managerAccountId, parentId: clinicAdminId }));
      
      const existingDocs = createMockLegalDocs({
        verificationStatus: LegalDocumentVerificationStatus.REJECTED,
      });
      clinicLegalDocsRepository.findByAccountId.mockResolvedValue(existingDocs);

      await service.uploadLegalDocumentsForManager(clinicAdminId, managerAccountId, validDto);

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
        .mockResolvedValueOnce(createMockAccount({ _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN }))
        .mockResolvedValueOnce(createMockClinicManager({ _id: managerAccountId, parentId: clinicAdminId }));
      
      await service.uploadLegalDocumentsForManager(clinicAdminId, managerAccountId, validDto);

      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          subscriptionStatus: RegistrationStatus.PENDING_APPROVAL,
        }),
      );
    });

    it('should set verification status to PENDING_REVIEW', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(createMockAccount({ _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN }))
        .mockResolvedValueOnce(createMockClinicManager({ _id: managerAccountId, parentId: clinicAdminId }));
      
      await service.uploadLegalDocumentsForManager(clinicAdminId, managerAccountId, validDto);

      expect(clinicLegalDocsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
        }),
      );
    });

    it('should rollback transaction on error', async () => {
      accountRepository.findAccountById
        .mockResolvedValueOnce(createMockAccount({ _id: clinicAdminId, role: AccountRole.CLINIC_ADMIN }))
        .mockResolvedValueOnce(createMockClinicManager({ _id: managerAccountId, parentId: clinicAdminId }));
      
      queryRunner.manager.save.mockRejectedValue(new Error('Database error'));

      await expect(
        service.uploadLegalDocumentsForManager(clinicAdminId, managerAccountId, validDto),
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
      const deleteOrder = queryRunner.manager.delete.mock.calls.map((call) => call[0].name);
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

      await expect(service.cancelPendingRegistration(accountId)).rejects.toThrow(
        BadRequestException,
      );
      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should reject if status is ACTIVE', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.ACTIVE,
        }),
      );

      await expect(service.cancelPendingRegistration(accountId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if status is NON_RENEWING', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.NON_RENEWING,
        }),
      );

      await expect(service.cancelPendingRegistration(accountId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if status is EXPIRED', async () => {
      clinicSubscriptionRepository.findByClinicId.mockResolvedValue(
        createMockClinicSubscription({
          subscriptionStatus: RegistrationStatus.EXPIRED,
        }),
      );

      await expect(service.cancelPendingRegistration(accountId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject if SUCCESS transaction exists', async () => {
      transactionRepository.findOne.mockResolvedValue({
        _id: 'tx-1',
        status: PaymentStatus.SUCCESS,
      });

      await expect(service.cancelPendingRegistration(accountId)).rejects.toThrow(
        BadRequestException,
      );
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

      await expect(service.cancelPendingRegistration(accountId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should rollback transaction on error', async () => {
      queryRunner.manager.delete.mockRejectedValue(new Error('Database error'));

      await expect(service.cancelPendingRegistration(accountId)).rejects.toThrow('Database error');
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
        (call) => call[0].name === 'Account' && call[1].role === AccountRole.CLINIC_MANAGER,
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
          (service as any).validateManagerStatus(managerId, 'CREATE_STAFF')
        ).rejects.toThrow('Manager account not found');
      });

      it('should throw ForbiddenException if account is not a manager', async () => {
        accountRepository.findAccountById = jest.fn().mockResolvedValue(
          createMockAccount({ role: AccountRole.CLINIC_STAFF })
        );

        await expect(
          (service as any).validateManagerStatus(managerId, 'CREATE_STAFF')
        ).rejects.toThrow('Account is not a clinic manager');
      });

      it('should throw ForbiddenException if manager is PENDING_APPROVAL', async () => {
        accountRepository.findAccountById = jest.fn().mockResolvedValue(
          createMockManager({ status: AccountStatus.PENDING_APPROVAL })
        );

        await expect(
          (service as any).validateManagerStatus(managerId, 'CREATE_STAFF')
        ).rejects.toThrow('Manager legal documents pending approval');
      });

      it('should throw ForbiddenException if manager is MANAGER_DISABLED', async () => {
        accountRepository.findAccountById = jest.fn().mockResolvedValue(
          createMockManager({ status: AccountStatus.MANAGER_DISABLED })
        );

        await expect(
          (service as any).validateManagerStatus(managerId, 'CREATE_STAFF')
        ).rejects.toThrow('Manager account is disabled');
      });

      it('should throw ForbiddenException if manager status is not ACTIVE', async () => {
        accountRepository.findAccountById = jest.fn().mockResolvedValue(
          createMockManager({ status: AccountStatus.BAN })
        );

        await expect(
          (service as any).validateManagerStatus(managerId, 'CREATE_STAFF')
        ).rejects.toThrow('Manager account must be ACTIVE to create staff members');
      });

      it('should return manager entity if status is ACTIVE', async () => {
        const mockManager = createMockManager({ status: AccountStatus.ACTIVE });
        accountRepository.findAccountById = jest.fn().mockResolvedValue(mockManager);

        const result = await (service as any).validateManagerStatus(managerId, 'CREATE_STAFF');

        expect(result).toEqual(mockManager);
        expect(accountRepository.findAccountById).toHaveBeenCalledWith(managerId);
      });
    });

    describe('ENABLE operation', () => {
      it('should throw NotFoundException if manager not found', async () => {
        accountRepository.findAccountById = jest.fn().mockResolvedValue(null);

        await expect(
          (service as any).validateManagerStatus(managerId, 'ENABLE')
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException if manager is not MANAGER_DISABLED', async () => {
        accountRepository.findAccountById = jest.fn().mockResolvedValue(
          createMockManager({ status: AccountStatus.ACTIVE })
        );

        await expect(
          (service as any).validateManagerStatus(managerId, 'ENABLE')
        ).rejects.toThrow('Can only enable managers with MANAGER_DISABLED status');
      });

      it('should return manager entity if status is MANAGER_DISABLED', async () => {
        const mockManager = createMockManager({ status: AccountStatus.MANAGER_DISABLED });
        accountRepository.findAccountById = jest.fn().mockResolvedValue(mockManager);

        const result = await (service as any).validateManagerStatus(managerId, 'ENABLE');

        expect(result).toEqual(mockManager);
      });
    });

    describe('DISABLE operation', () => {
      it('should throw NotFoundException if manager not found', async () => {
        accountRepository.findAccountById = jest.fn().mockResolvedValue(null);

        await expect(
          (service as any).validateManagerStatus(managerId, 'DISABLE')
        ).rejects.toThrow(NotFoundException);
      });

      it('should throw BadRequestException if manager is not ACTIVE', async () => {
        accountRepository.findAccountById = jest.fn().mockResolvedValue(
          createMockManager({ status: AccountStatus.PENDING_APPROVAL })
        );

        await expect(
          (service as any).validateManagerStatus(managerId, 'DISABLE')
        ).rejects.toThrow('Can only disable managers with ACTIVE status');
      });

      it('should return manager entity if status is ACTIVE', async () => {
        const mockManager = createMockManager({ status: AccountStatus.ACTIVE });
        accountRepository.findAccountById = jest.fn().mockResolvedValue(mockManager);

        const result = await (service as any).validateManagerStatus(managerId, 'DISABLE');

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
      accountRepository.findAccountById = jest.fn().mockResolvedValue(mockManager);
      accountRepository.findByEmail = jest.fn().mockResolvedValue(null);
    });

    it('should call validateManagerStatus before creating staff', async () => {
      const validateSpy = jest.spyOn(service as any, 'validateManagerStatus');

      // Mock successful staff creation
      accountRepository.findAccountByEmail.mockResolvedValue(null);
      queryRunner.manager.save
        .mockResolvedValueOnce(createMockAccount({ role: AccountRole.CLINIC_STAFF }))
        .mockResolvedValueOnce({ accountId: 'staff-1', fullName: 'Staff Member', clinicRole: ClinicRole.STAFF });

      await service.createStaffByClinicManager(managerId, validStaffDto);

      expect(validateSpy).toHaveBeenCalledWith(managerId, 'CREATE_STAFF');
      expect(validateSpy).toHaveBeenCalled();
    });

    it('should block staff creation if manager is PENDING_APPROVAL', async () => {
      accountRepository.findAccountById = jest.fn().mockResolvedValue(
        createMockManager({ status: AccountStatus.PENDING_APPROVAL })
      );

      await expect(
        service.createStaffByClinicManager(managerId, validStaffDto)
      ).rejects.toThrow('Manager legal documents pending approval');

      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should block staff creation if manager is MANAGER_DISABLED', async () => {
      accountRepository.findAccountById = jest.fn().mockResolvedValue(
        createMockManager({ status: AccountStatus.MANAGER_DISABLED })
      );

      await expect(
        service.createStaffByClinicManager(managerId, validStaffDto)
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
      accountRepository.findAccountById = jest.fn().mockResolvedValue(mockManager);
      accountRepository.findByEmail = jest.fn().mockResolvedValue(null);
    });

    it('should call validateManagerStatus before creating doctor', async () => {
      const validateSpy = jest.spyOn(service as any, 'validateManagerStatus');

      // Mock successful doctor creation
      accountRepository.findAccountByEmail.mockResolvedValue(null);
      queryRunner.manager.save
        .mockResolvedValueOnce(createMockAccount({ role: AccountRole.DOCTOR }))
        .mockResolvedValueOnce({ accountId: 'doctor-1', fullName: 'Dr. John Doe', specialization: 'Cardiology' });

      await service.createDoctorByClinicManager(managerId, validDoctorDto);

      expect(validateSpy).toHaveBeenCalledWith(managerId, 'CREATE_STAFF');
      expect(validateSpy).toHaveBeenCalled();
    });

    it('should block doctor creation if manager is PENDING_APPROVAL', async () => {
      accountRepository.findAccountById = jest.fn().mockResolvedValue(
        createMockManager({ status: AccountStatus.PENDING_APPROVAL })
      );

      await expect(
        service.createDoctorByClinicManager(managerId, validDoctorDto)
      ).rejects.toThrow('Manager legal documents pending approval');

      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should block doctor creation if manager is MANAGER_DISABLED', async () => {
      accountRepository.findAccountById = jest.fn().mockResolvedValue(
        createMockManager({ status: AccountStatus.MANAGER_DISABLED })
      );

      await expect(
        service.createDoctorByClinicManager(managerId, validDoctorDto)
      ).rejects.toThrow('Manager account is disabled');

      expect(queryRunner.startTransaction).not.toHaveBeenCalled();
    });
  });
});
