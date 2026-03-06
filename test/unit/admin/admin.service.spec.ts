import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from '../../../src/modules/admin/admin.service';
import { AdminRegistrationRepository } from '../../../src/modules/admin/repositories/admin-registration.repository';
import { ClinicsLegalDocumentsRepository } from '../../../src/modules/accounts/repositories/clinics-legal-documents.repository';
import { ClinicSubscriptionRepository } from '../../../src/modules/subscriptions/repositories/clinic-subscription.repository';
import { ClinicAdminInformationRepository } from '../../../src/modules/accounts/repositories';
import { MailerService } from '../../../src/modules/mailer/mailer.service';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Account } from '../../../src/modules/accounts/entities/accounts.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LegalDocumentVerificationStatus } from '../../../src/modules/accounts/enums/legal-document-verification-status.enum';
import { RegistrationStatus } from '../../../src/modules/subscriptions/enums/subscription-status.enum';
import { AccountRole } from '../../../src/modules/accounts/enums/account-role.enum';
import { AccountStatus } from '../../../src/modules/accounts/enums/account-status.enum';

describe('AdminService', () => {
  let service: AdminService;
  let adminRegistrationRepository: any;
  let legalDocumentsRepository: any;
  let clinicSubscriptionRepository: any;
  let clinicAdminInfoRepository: any;
  let mailerService: any;
  let dataSource: any;
  let accountRepository: any;
  let mockQueryRunner: any;

  // Mock Data Factories
  const createMockClinicAdmin = (overrides = {}) => ({
    _id: 'admin-123',
    email: 'admin@clinic.com',
    role: AccountRole.CLINIC_ADMIN,
    children: [
      {
        _id: 'manager-123',
        role: AccountRole.CLINIC_MANAGER,
        email: 'manager@clinic.com',
        status: AccountStatus.PENDING_APPROVAL,
      },
    ],
    clinicAdminInformation: {
      clinicName: 'Test Clinic',
    },
    ...overrides,
  });

  const createMockLegalDocs = (overrides = {}) => ({
    _id: 'legal-docs-123',
    accountId: 'manager-123',
    verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
    businessLicense: 'https://example.com/business-license.pdf',
    taxIdUrl: 'https://example.com/tax-id.pdf',
    operatingLicense: 'https://example.com/operating-license.pdf',
    rejectionReason: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  });

  const createMockSubscription = (overrides = {}) => ({
    _id: 'subscription-123',
    clinicId: 'admin-123',
    serviceId: 'service-123',
    subscriptionStatus: RegistrationStatus.PENDING_APPROVAL,
    subscriptionDate: new Date('2026-01-01'),
    expirationDate: new Date('2026-12-31'),
    ...overrides,
  });

  const createMockRegistrationList = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      _id: `legal-docs-${i}`,
      clinicName: `Clinic ${i}`,
      managerFullName: `Manager ${i}`,
      managerEmail: `manager${i}@clinic.com`,
      verificationStatus: LegalDocumentVerificationStatus.PENDING_REVIEW,
      businessLicense: `https://example.com/business-${i}.pdf`,
      createdAt: new Date(),
    }));
  };

  beforeEach(async () => {
    // Mock QueryRunner for transaction testing
    mockQueryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        save: jest.fn().mockImplementation((entity, data) => Promise.resolve(data)),
      },
    };

    // Mock Repositories
    adminRegistrationRepository = {
      findRegistrationById: jest.fn(),
      findPendingLegalDocuments: jest.fn(),
      findApprovedLegalDocuments: jest.fn(),
      findRejectedLegalDocuments: jest.fn(),
      findNotSubmittedRegistrations: jest.fn(),
    };

    legalDocumentsRepository = {
      findByAccountId: jest.fn(),
      save: jest.fn(),
    };

    clinicSubscriptionRepository = {
      findByClinicId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
    };

    clinicAdminInfoRepository = {
      findByAccountId: jest.fn(),
    };

    mailerService = {
      sendRegistrationApprovedEmail: jest.fn().mockResolvedValue(undefined),
      sendRegistrationRejectedEmail: jest.fn().mockResolvedValue(undefined),
    };

    accountRepository = {
      findOne: jest.fn(),
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: AdminRegistrationRepository,
          useValue: adminRegistrationRepository,
        },
        {
          provide: ClinicsLegalDocumentsRepository,
          useValue: legalDocumentsRepository,
        },
        {
          provide: ClinicSubscriptionRepository,
          useValue: clinicSubscriptionRepository,
        },
        {
          provide: ClinicAdminInformationRepository,
          useValue: clinicAdminInfoRepository,
        },
        {
          provide: MailerService,
          useValue: mailerService,
        },
        {
          provide: getRepositoryToken(Account),
          useValue: accountRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPendingLegalDocuments', () => {
    it('TC-01: should return paginated list of pending legal documents', async () => {
      // Setup
      const mockData = createMockRegistrationList(5);
      adminRegistrationRepository.findPendingLegalDocuments.mockResolvedValue([
        mockData,
        5,
      ]);

      // Execute
      const result = await service.getPendingLegalDocuments(1, 10);

      // Verify
      expect(result).toBeDefined();
      expect(result.data).toEqual(mockData);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        totalItems: 5,
        totalPages: 1,
      });
      expect(
        adminRegistrationRepository.findPendingLegalDocuments,
      ).toHaveBeenCalledWith(1, 10, 'createdAt', 'DESC');
    });

    it('TC-02: should calculate pagination correctly for multiple pages', async () => {
      // Setup
      const mockData = createMockRegistrationList(10);
      adminRegistrationRepository.findPendingLegalDocuments.mockResolvedValue([
        mockData,
        25,
      ]);

      // Execute
      const result = await service.getPendingLegalDocuments(2, 10);

      // Verify
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        totalItems: 25,
        totalPages: 3,
      });
    });

    it('TC-03: should return empty list when no pending documents', async () => {
      // Setup
      adminRegistrationRepository.findPendingLegalDocuments.mockResolvedValue([
        [],
        0,
      ]);

      // Execute
      const result = await service.getPendingLegalDocuments(1, 10);

      // Verify
      expect(result.data).toEqual([]);
      expect(result.meta.totalItems).toBe(0);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('getApprovedLegalDocuments', () => {
    it('TC-04: should return list of approved legal documents', async () => {
      // Setup
      const mockData = createMockRegistrationList(3).map((item) => ({
        ...item,
        verificationStatus: LegalDocumentVerificationStatus.APPROVED,
      }));
      adminRegistrationRepository.findApprovedLegalDocuments.mockResolvedValue([
        mockData,
        3,
      ]);

      // Execute
      const result = await service.getApprovedLegalDocuments(1, 10);

      // Verify
      expect(result.data).toHaveLength(3);
      expect(result.data[0].verificationStatus).toBe(
        LegalDocumentVerificationStatus.APPROVED,
      );
      expect(result.meta.totalItems).toBe(3);
    });
  });

  describe('getRejectedLegalDocuments', () => {
    it('TC-05: should return list of rejected legal documents with rejection reason', async () => {
      // Setup
      const mockData = createMockRegistrationList(2).map((item) => ({
        ...item,
        verificationStatus: LegalDocumentVerificationStatus.REJECTED,
        rejectionReason: 'Documents are unclear',
      }));
      adminRegistrationRepository.findRejectedLegalDocuments.mockResolvedValue([
        mockData,
        2,
      ]);

      // Execute
      const result = await service.getRejectedLegalDocuments(1, 10);

      // Verify
      expect(result.data).toHaveLength(2);
      expect(result.data[0].verificationStatus).toBe(
        LegalDocumentVerificationStatus.REJECTED,
      );
      expect(result.data[0].rejectionReason).toBe('Documents are unclear');
    });
  });

  describe('getRegistrationById', () => {
    it('TC-07: should return full registration details', async () => {
      // Setup
      const mockRegistration = {
        clinicAdminId: 'admin-123',
        clinicName: 'Test Clinic',
        managerEmail: 'manager@clinic.com',
        legalDocs: createMockLegalDocs(),
        subscription: createMockSubscription(),
      };
      adminRegistrationRepository.findRegistrationById.mockResolvedValue(
        mockRegistration,
      );

      // Execute
      const result = await service.getRegistrationById('admin-123');

      // Verify
      expect(result).toEqual(mockRegistration);
      expect(
        adminRegistrationRepository.findRegistrationById,
      ).toHaveBeenCalledWith('admin-123');
    });

    it('TC-08: should throw NotFoundException when registration not found', async () => {
      // Setup
      adminRegistrationRepository.findRegistrationById.mockResolvedValue(null);

      // Execute & Verify
      await expect(service.getRegistrationById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getRegistrationById('invalid-id')).rejects.toThrow(
        'Registration not found',
      );
    });
  });

  describe('approveRegistrationBySubscriptionId', () => {
    it('TC-09: should approve registration and update Manager status to ACTIVE', async () => {
      // Setup
      const mockClinicAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();
      const mockManager = mockClinicAdmin.children[0];

      clinicSubscriptionRepository.findById.mockResolvedValue(mockSubscription);
      accountRepository.findOne.mockResolvedValue(mockClinicAdmin);
      legalDocumentsRepository.findByAccountId.mockResolvedValue(mockLegalDocs);

      // Execute
      const result = await service.approveRegistrationBySubscriptionId('subscription-123');

      // Verify
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          verificationStatus: LegalDocumentVerificationStatus.APPROVED,
          rejectionReason: null,
        }),
      );
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          _id: 'manager-123',
          status: AccountStatus.ACTIVE,
        }),
      );
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          subscriptionStatus: RegistrationStatus.PENDING_PAYMENT,
        }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.newStatus).toBe('PENDING_PAYMENT');
    });

    it('TC-10: should throw NotFoundException when subscription not found', async () => {
      // Setup
      clinicSubscriptionRepository.findById.mockResolvedValue(null);

      // Execute & Verify
      await expect(
        service.approveRegistrationBySubscriptionId('invalid-id'),
      ).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('TC-11: should throw BadRequestException when subscription not in PENDING_APPROVAL', async () => {
      // Setup
      const mockSubscription = createMockSubscription({
        subscriptionStatus: RegistrationStatus.ACTIVE,
      });
      clinicSubscriptionRepository.findById.mockResolvedValue(mockSubscription);

      // Execute & Verify
      await expect(
        service.approveRegistrationBySubscriptionId('subscription-123'),
      ).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('TC-12: should rollback transaction on error', async () => {
      // Setup
      const mockClinicAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();

      clinicSubscriptionRepository.findById.mockResolvedValue(mockSubscription);
      accountRepository.findOne.mockResolvedValue(mockClinicAdmin);
      legalDocumentsRepository.findByAccountId.mockResolvedValue(mockLegalDocs);
      mockQueryRunner.manager.save.mockRejectedValueOnce(new Error('DB Error'));

      // Execute & Verify
      await expect(
        service.approveRegistrationBySubscriptionId('subscription-123'),
      ).rejects.toThrow('DB Error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('rejectRegistrationBySubscriptionId', () => {
    it('TC-13: should reject registration and keep Manager status as PENDING_APPROVAL', async () => {
      // Setup
      const mockClinicAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();
      const rejectionReason = 'Documents are unclear and incomplete';

      clinicSubscriptionRepository.findById.mockResolvedValue(mockSubscription);
      accountRepository.findOne.mockResolvedValue(mockClinicAdmin);
      legalDocumentsRepository.findByAccountId.mockResolvedValue(mockLegalDocs);

      // Execute
      const result = await service.rejectRegistrationBySubscriptionId(
        'subscription-123',
        rejectionReason,
      );

      // Verify
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          verificationStatus: LegalDocumentVerificationStatus.REJECTED,
          rejectionReason: rejectionReason,
        }),
      );
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          _id: 'manager-123',
          status: AccountStatus.PENDING_APPROVAL,
        }),
      );
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          subscriptionStatus: RegistrationStatus.PENDING_LEGAL_SETUP,
        }),
      );
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.newStatus).toBe('PENDING_LEGAL_SETUP');
      expect(result.data.rejectionReason).toBe(rejectionReason);
    });

    it('TC-14: should throw NotFoundException when subscription not found', async () => {
      // Setup
      clinicSubscriptionRepository.findById.mockResolvedValue(null);

      // Execute & Verify
      await expect(
        service.rejectRegistrationBySubscriptionId('invalid-id', 'Some reason'),
      ).rejects.toThrow(NotFoundException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('TC-15: should throw BadRequestException when legal docs not in PENDING_REVIEW', async () => {
      // Setup
      const mockClinicAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs({
        verificationStatus: LegalDocumentVerificationStatus.APPROVED,
      });
      const mockSubscription = createMockSubscription();

      clinicSubscriptionRepository.findById.mockResolvedValue(mockSubscription);
      accountRepository.findOne.mockResolvedValue(mockClinicAdmin);
      legalDocumentsRepository.findByAccountId.mockResolvedValue(mockLegalDocs);

      // Execute & Verify
      await expect(
        service.rejectRegistrationBySubscriptionId('subscription-123', 'Some reason'),
      ).rejects.toThrow(BadRequestException);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('TC-16: should rollback transaction on database error', async () => {
      // Setup
      const mockClinicAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();

      clinicSubscriptionRepository.findById.mockResolvedValue(mockSubscription);
      accountRepository.findOne.mockResolvedValue(mockClinicAdmin);
      legalDocumentsRepository.findByAccountId.mockResolvedValue(mockLegalDocs);
      mockQueryRunner.manager.save.mockRejectedValueOnce(new Error('DB Error'));

      // Execute & Verify
      await expect(
        service.rejectRegistrationBySubscriptionId('subscription-123', 'Test reason'),
      ).rejects.toThrow('DB Error');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

});
