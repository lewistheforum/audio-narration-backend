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
      findPendingApprovals: jest.fn(),
      findRegistrationById: jest.fn(),
      findClinicAdminById: jest.fn(),
      findLegalDocumentsByManagerId: jest.fn(),
      findSubscriptionByClinicId: jest.fn(),
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

  describe('getNotSubmittedRegistrations', () => {
    it('TC-06: should return list of not submitted registrations', async () => {
      // Setup
      const mockData = createMockRegistrationList(4).map((item) => ({
        ...item,
        verificationStatus: LegalDocumentVerificationStatus.NOT_SUBMITTED,
      }));
      adminRegistrationRepository.findNotSubmittedRegistrations.mockResolvedValue(
        [mockData, 4],
      );

      // Execute
      const result = await service.getNotSubmittedRegistrations(1, 10);

      // Verify
      expect(result.data).toHaveLength(4);
      expect(result.meta.totalItems).toBe(4);
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

  describe('approveRegistration', () => {
    it('TC-09: should approve registration successfully', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();
      const mockClinicAdminInfo = { clinicName: 'Test Clinic' };

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );
      adminRegistrationRepository.findSubscriptionByClinicId.mockResolvedValue(
        mockSubscription,
      );
      clinicAdminInfoRepository.findByAccountId.mockResolvedValue(
        mockClinicAdminInfo,
      );

      // Execute
      await service.approveRegistration('admin-123');

      // Verify
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);

      // Verify Legal Docs update
      const legalDocsSave = mockQueryRunner.manager.save.mock.calls[0];
      expect(legalDocsSave[1].verificationStatus).toBe(
        LegalDocumentVerificationStatus.APPROVED,
      );

      // Verify Subscription update
      const subscriptionSave = mockQueryRunner.manager.save.mock.calls[1];
      expect(subscriptionSave[1].subscriptionStatus).toBe(
        RegistrationStatus.PENDING_PAYMENT,
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();

      // Verify email sent
      expect(
        mailerService.sendRegistrationApprovedEmail,
      ).toHaveBeenCalledWith('admin@clinic.com', 'Test Clinic');
    });

    it('TC-10: should complete approval even if email fails', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );
      adminRegistrationRepository.findSubscriptionByClinicId.mockResolvedValue(
        mockSubscription,
      );
      clinicAdminInfoRepository.findByAccountId.mockResolvedValue({
        clinicName: 'Test Clinic',
      });

      // Mock email failure
      mailerService.sendRegistrationApprovedEmail.mockRejectedValue(
        new Error('Email service down'),
      );

      // Spy on console.error
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Execute - should not throw
      await expect(
        service.approveRegistration('admin-123'),
      ).resolves.not.toThrow();

      // Verify transaction still committed
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('TC-11: should throw NotFoundException when clinic admin not found', async () => {
      // Setup
      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(null);

      // Execute & Verify
      await expect(service.approveRegistration('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.approveRegistration('invalid-id')).rejects.toThrow(
        'Clinic admin account not found',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('TC-12: should throw NotFoundException when clinic manager not found', async () => {
      // Setup
      const mockAdminWithoutManager = createMockClinicAdmin({
        children: [], // No manager
      });
      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdminWithoutManager,
      );

      // Execute & Verify
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        'Clinic manager account not found',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('TC-13: should throw NotFoundException when legal documents not found', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        null,
      );

      // Execute & Verify
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        'Legal documents not found',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('TC-14: should throw BadRequestException when legal docs not in PENDING_REVIEW status', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs({
        verificationStatus: LegalDocumentVerificationStatus.APPROVED, // Already approved
      });

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );

      // Execute & Verify
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        'Legal documents are not in PENDING_REVIEW status',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('TC-15: should throw NotFoundException when subscription not found', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );
      adminRegistrationRepository.findSubscriptionByClinicId.mockResolvedValue(
        null,
      );

      // Execute & Verify
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        'Subscription not found',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('TC-16: should throw BadRequestException when subscription not in PENDING_APPROVAL status', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription({
        subscriptionStatus: RegistrationStatus.ACTIVE, // Wrong status
      });

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );
      adminRegistrationRepository.findSubscriptionByClinicId.mockResolvedValue(
        mockSubscription,
      );

      // Execute & Verify
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        'Subscription is not in PENDING_APPROVAL status',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('TC-17: should rollback transaction when commit fails', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );
      adminRegistrationRepository.findSubscriptionByClinicId.mockResolvedValue(
        mockSubscription,
      );

      // Mock commit failure
      mockQueryRunner.commitTransaction.mockRejectedValue(
        new Error('Database error'),
      );

      // Execute & Verify
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        'Database error',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();

      // Email should not be sent
      expect(
        mailerService.sendRegistrationApprovedEmail,
      ).not.toHaveBeenCalled();
    });
  });

  describe('rejectRegistration', () => {
    it('TC-18: should reject registration successfully and revert to PENDING_LEGAL_SETUP', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();
      const mockClinicAdminInfo = { clinicName: 'Test Clinic' };
      const rejectionReason = 'Giấy tờ không rõ ràng';

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );
      adminRegistrationRepository.findSubscriptionByClinicId.mockResolvedValue(
        mockSubscription,
      );
      clinicAdminInfoRepository.findByAccountId.mockResolvedValue(
        mockClinicAdminInfo,
      );

      // Execute
      await service.rejectRegistration('admin-123', rejectionReason);

      // Verify
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);

      // Verify Legal Docs update
      const legalDocsSave = mockQueryRunner.manager.save.mock.calls[0];
      expect(legalDocsSave[1].verificationStatus).toBe(
        LegalDocumentVerificationStatus.REJECTED,
      );
      expect(legalDocsSave[1].rejectionReason).toBe(rejectionReason);

      // IMPORTANT: Verify Subscription reverted to PENDING_LEGAL_SETUP (NOT REJECTED)
      const subscriptionSave = mockQueryRunner.manager.save.mock.calls[1];
      expect(subscriptionSave[1].subscriptionStatus).toBe(
        RegistrationStatus.PENDING_LEGAL_SETUP,
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();

      // Verify email sent with reason
      expect(
        mailerService.sendRegistrationRejectedEmail,
      ).toHaveBeenCalledWith('admin@clinic.com', rejectionReason, 'Test Clinic');
    });

    it('TC-19: should complete rejection even if email fails', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );
      adminRegistrationRepository.findSubscriptionByClinicId.mockResolvedValue(
        mockSubscription,
      );
      clinicAdminInfoRepository.findByAccountId.mockResolvedValue({
        clinicName: 'Test Clinic',
      });

      // Mock email failure
      mailerService.sendRegistrationRejectedEmail.mockRejectedValue(
        new Error('Email service down'),
      );

      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Execute
      await expect(
        service.rejectRegistration('admin-123', 'Some reason'),
      ).resolves.not.toThrow();

      // Verify transaction still committed
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('TC-20: should throw BadRequestException when legal docs not in PENDING_REVIEW status', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs({
        verificationStatus: LegalDocumentVerificationStatus.REJECTED, // Already rejected
      });

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );

      // Execute & Verify
      await expect(
        service.rejectRegistration('admin-123', 'Some reason'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.rejectRegistration('admin-123', 'Some reason'),
      ).rejects.toThrow('Legal documents are not in PENDING_REVIEW status');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('TC-21: should throw BadRequestException when subscription not in PENDING_APPROVAL status', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription({
        subscriptionStatus: RegistrationStatus.EXPIRED, // Wrong status
      });

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );
      adminRegistrationRepository.findSubscriptionByClinicId.mockResolvedValue(
        mockSubscription,
      );

      // Execute & Verify
      await expect(
        service.rejectRegistration('admin-123', 'Some reason'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.rejectRegistration('admin-123', 'Some reason'),
      ).rejects.toThrow('Subscription is not in PENDING_APPROVAL status');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('TC-22: should rollback transaction when save fails', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );
      adminRegistrationRepository.findSubscriptionByClinicId.mockResolvedValue(
        mockSubscription,
      );

      // Mock save failure
      mockQueryRunner.manager.save.mockRejectedValue(
        new Error('Database error'),
      );

      // Execute & Verify
      await expect(
        service.rejectRegistration('admin-123', 'Some reason'),
      ).rejects.toThrow('Database error');

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });

  describe('Transaction Integrity', () => {
    it('TC-26: should rollback when legal docs update fails during approval', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );
      adminRegistrationRepository.findSubscriptionByClinicId.mockResolvedValue(
        mockSubscription,
      );

      // Mock first save (legal docs) fails
      mockQueryRunner.manager.save.mockRejectedValueOnce(
        new Error('Legal docs save failed'),
      );

      // Execute & Verify
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        'Legal docs save failed',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('TC-27: should rollback when subscription update fails during approval', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );
      adminRegistrationRepository.findSubscriptionByClinicId.mockResolvedValue(
        mockSubscription,
      );

      // Mock first save succeeds, second save (subscription) fails
      mockQueryRunner.manager.save
        .mockResolvedValueOnce(mockLegalDocs)
        .mockRejectedValueOnce(new Error('Subscription save failed'));

      // Execute & Verify
      await expect(service.approveRegistration('admin-123')).rejects.toThrow(
        'Subscription save failed',
      );

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    it('TC-28: should commit only when all updates succeed', async () => {
      // Setup
      const mockAdmin = createMockClinicAdmin();
      const mockLegalDocs = createMockLegalDocs();
      const mockSubscription = createMockSubscription();

      adminRegistrationRepository.findClinicAdminById.mockResolvedValue(
        mockAdmin,
      );
      adminRegistrationRepository.findLegalDocumentsByManagerId.mockResolvedValue(
        mockLegalDocs,
      );
      adminRegistrationRepository.findSubscriptionByClinicId.mockResolvedValue(
        mockSubscription,
      );
      clinicAdminInfoRepository.findByAccountId.mockResolvedValue({
        clinicName: 'Test Clinic',
      });

      // Execute
      await service.approveRegistration('admin-123');

      // Verify
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
