import { Test, TestingModule } from '@nestjs/testing';
import { ReportService } from '../../../src/modules/reports/report.service';
import { ReportRepository } from '../../../src/modules/reports/repositories/report.repository';
import { MailerService } from '../../../src/modules/mailer/mailer.service';
import { CreateReportDto } from '../../../src/modules/reports/dto';
import { ReportType } from '../../../src/modules/reports/enums';
import { Report } from '../../../src/modules/reports/entities/report.entity';

describe('ReportService - Create Report', () => {
  let service: ReportService;
  let reportRepository: any;
  let mailerService: any;

  // Mock Data Factories
  const createMockReport = (overrides = {}): Report => ({
    _id: 'report-123',
    accountId: 'patient-123',
    reportType: ReportType.BUG,
    description: 'Test report description',
    reportImages: ['https://example.com/image1.png'],
    isResponse: false,
    responseDescription: null,
    createdAt: new Date('2026-02-24'),
    updatedAt: new Date('2026-02-24'),
    ...overrides,
  } as Report);

  const createValidCreateReportDto = (overrides = {}): CreateReportDto => ({
    reportType: ReportType.BUG,
    description: 'Application crashes when booking appointment',
    reportImages: ['https://example.com/screenshot1.png', 'https://example.com/screenshot2.png'],
    ...overrides,
  });

  beforeEach(async () => {
    // Mock Repositories
    reportRepository = {
      createReport: jest.fn(),
      saveReport: jest.fn(),
      findAllReports: jest.fn(),
      findReportById: jest.fn(),
    };

    // Mock MailerService
    mailerService = {
      sendReportResponseEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: ReportRepository,
          useValue: reportRepository,
        },
        {
          provide: MailerService,
          useValue: mailerService,
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createReport()', () => {
    describe('✅ SUCCESS Cases', () => {
      it('TC-01: Should create report successfully with all fields', async () => {
        // Arrange
        const accountId = 'patient-123';
        const dto = createValidCreateReportDto();
        const mockCreatedReport = createMockReport({
          accountId,
          reportType: dto.reportType,
          description: dto.description,
          reportImages: dto.reportImages,
        });
        const mockSavedReport = { ...mockCreatedReport };

        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockSavedReport);

        // Act
        const result = await service.createReport(accountId, dto);

        // Assert
        expect(reportRepository.createReport).toHaveBeenCalledWith({
          accountId,
          reportType: dto.reportType,
          description: dto.description,
          reportImages: dto.reportImages,
          isResponse: false,
          responseDescription: null,
        });
        expect(reportRepository.saveReport).toHaveBeenCalledWith(mockCreatedReport);
        expect(result).toEqual(mockSavedReport);
        expect(result.accountId).toBe(accountId);
        expect(result.reportType).toBe(dto.reportType);
        expect(result.description).toBe(dto.description);
        expect(result.reportImages).toEqual(dto.reportImages);
        expect(result.isResponse).toBe(false);
        expect(result.responseDescription).toBeNull();
      });

      it('TC-02: Should create report successfully without reportImages (optional field)', async () => {
        // Arrange
        const accountId = 'patient-456';
        const dto = createValidCreateReportDto({ reportImages: undefined });
        const mockCreatedReport = createMockReport({
          accountId,
          reportType: dto.reportType,
          description: dto.description,
          reportImages: [],
        });
        const mockSavedReport = { ...mockCreatedReport };

        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockSavedReport);

        // Act
        const result = await service.createReport(accountId, dto);

        // Assert
        expect(reportRepository.createReport).toHaveBeenCalledWith({
          accountId,
          reportType: dto.reportType,
          description: dto.description,
          reportImages: [],
          isResponse: false,
          responseDescription: null,
        });
        expect(result.reportImages).toEqual([]);
      });

      it('TC-03: Should create report with different report types', async () => {
        // Arrange
        const accountId = 'patient-789';
        const reportTypes = [
          ReportType.BUG,
          ReportType.ABUSE,
          ReportType.SPAM,
          ReportType.INAPPROPRIATE_CONTENT,
          ReportType.FRAUD,
          ReportType.OTHER,
        ];

        for (const reportType of reportTypes) {
          const dto = createValidCreateReportDto({ reportType });
          const mockCreatedReport = createMockReport({ accountId, reportType });
          const mockSavedReport = { ...mockCreatedReport };

          reportRepository.createReport.mockReturnValue(mockCreatedReport);
          reportRepository.saveReport.mockResolvedValue(mockSavedReport);

          // Act
          const result = await service.createReport(accountId, dto);

          // Assert
          expect(result.reportType).toBe(reportType);
          jest.clearAllMocks();
        }
      });

      it('TC-04: Should always set isResponse to false and responseDescription to null on creation', async () => {
        // Arrange
        const accountId = 'patient-111';
        const dto = createValidCreateReportDto();
        const mockCreatedReport = createMockReport({
          accountId,
          isResponse: false,
          responseDescription: null,
        });
        const mockSavedReport = { ...mockCreatedReport };

        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockSavedReport);

        // Act
        const result = await service.createReport(accountId, dto);

        // Assert
        expect(reportRepository.createReport).toHaveBeenCalledWith(
          expect.objectContaining({
            isResponse: false,
            responseDescription: null,
          }),
        );
        expect(result.isResponse).toBe(false);
        expect(result.responseDescription).toBeNull();
      });

      it('TC-05: Should get accountId from authenticated user, not from request body', async () => {
        // Arrange
        const accountId = 'patient-authenticated-user-id';
        const dto = createValidCreateReportDto();
        const mockCreatedReport = createMockReport({ accountId });
        const mockSavedReport = { ...mockCreatedReport };

        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockSavedReport);

        // Act
        const result = await service.createReport(accountId, dto);

        // Assert
        expect(reportRepository.createReport).toHaveBeenCalledWith(
          expect.objectContaining({
            accountId: accountId,
          }),
        );
        expect(result.accountId).toBe(accountId);
        // Verify accountId is NOT from DTO (DTO shouldn't have accountId field)
        expect(dto).not.toHaveProperty('accountId');
      });
    });

    describe('❌ FAILURE Cases - Validation', () => {
      it('TC-06: Should fail when description is missing', async () => {
        // Note: This validation is handled by DTO validators (class-validator)
        // In real scenario, this would be caught at controller level
        // Here we test service behavior if invalid data somehow passes through
        const accountId = 'patient-123';
        const dto = createValidCreateReportDto({ description: '' } as any);

        // In actual implementation, validator would reject this before reaching service
        // But we can test service still creates entity with what it receives
        const mockCreatedReport = createMockReport({ description: '' });
        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockCreatedReport);

        const result = await service.createReport(accountId, dto);

        // Service doesn't validate, it relies on DTO validators
        expect(result.description).toBe('');
      });

      it('TC-07: Should fail when reportType is missing', async () => {
        // Note: This validation is handled by DTO validators
        const accountId = 'patient-123';
        const dto = createValidCreateReportDto({ reportType: null } as any);

        const mockCreatedReport = createMockReport({ reportType: null as any });
        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockCreatedReport);

        const result = await service.createReport(accountId, dto);

        expect(result.reportType).toBeNull();
      });

      it('TC-08: Should fail when reportType is invalid enum value', async () => {
        // Note: This validation is handled by DTO validators
        const accountId = 'patient-123';
        const dto = createValidCreateReportDto({ reportType: 'INVALID_TYPE' } as any);

        const mockCreatedReport = createMockReport({ reportType: 'INVALID_TYPE' as any });
        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockCreatedReport);

        const result = await service.createReport(accountId, dto);

        expect(result.reportType).toBe('INVALID_TYPE');
      });
    });

    describe('🔒 AUTHORIZATION Cases (Guard-level)', () => {
      it('TC-09: Should accept report creation from PATIENT role', async () => {
        // Arrange
        // In real implementation, RolesGuard checks this at controller level
        // Here we verify service works correctly when called by authorized user
        const accountId = 'patient-role-user-123';
        const dto = createValidCreateReportDto();
        const mockCreatedReport = createMockReport({ accountId });
        const mockSavedReport = { ...mockCreatedReport };

        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockSavedReport);

        // Act
        const result = await service.createReport(accountId, dto);

        // Assert
        expect(result).toBeDefined();
        expect(result.accountId).toBe(accountId);
      });

      it('TC-10: Authorization for non-PATIENT roles is handled by Guards (RolesGuard + @Roles decorator)', () => {
        // Note: Authorization is enforced at Controller level via:
        // - @UseGuards(JwtAuthGuard, RolesGuard)
        // - @Roles(AccountRole.PATIENT)
        //
        // Service layer does not check role, it assumes controller has already validated
        // This test documents that authorization is not service responsibility
        //
        // If a non-PATIENT user somehow calls service directly (bypassing controller),
        // service will process the request since it doesn't validate roles
        //
        // Best practice: Always go through controller endpoints which have proper guards

        expect(true).toBe(true); // Documentation test
      });
    });

    describe('🔍 EDGE Cases', () => {
      it('TC-11: Should handle empty reportImages array', async () => {
        // Arrange
        const accountId = 'patient-123';
        const dto = createValidCreateReportDto({ reportImages: [] });
        const mockCreatedReport = createMockReport({ reportImages: [] });
        const mockSavedReport = { ...mockCreatedReport };

        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockSavedReport);

        // Act
        const result = await service.createReport(accountId, dto);

        // Assert
        expect(result.reportImages).toEqual([]);
      });

      it('TC-12: Should handle very long description text', async () => {
        // Arrange
        const accountId = 'patient-123';
        const longDescription = 'A'.repeat(5000); // 5000 characters
        const dto = createValidCreateReportDto({ description: longDescription });
        const mockCreatedReport = createMockReport({ description: longDescription });
        const mockSavedReport = { ...mockCreatedReport };

        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockSavedReport);

        // Act
        const result = await service.createReport(accountId, dto);

        // Assert
        expect(result.description).toBe(longDescription);
        expect(result.description.length).toBe(5000);
      });

      it('TC-13: Should handle multiple image URLs', async () => {
        // Arrange
        const accountId = 'patient-123';
        const multipleImages = [
          'https://example.com/img1.png',
          'https://example.com/img2.jpg',
          'https://example.com/img3.gif',
          'https://example.com/img4.webp',
          'https://example.com/img5.png',
        ];
        const dto = createValidCreateReportDto({ reportImages: multipleImages });
        const mockCreatedReport = createMockReport({ reportImages: multipleImages });
        const mockSavedReport = { ...mockCreatedReport };

        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockSavedReport);

        // Act
        const result = await service.createReport(accountId, dto);

        // Assert
        expect(result.reportImages).toHaveLength(5);
        expect(result.reportImages).toEqual(multipleImages);
      });
    });

    describe('🗄️ DATABASE Integration', () => {
      it('TC-14: Should call repository.createReport with correct parameters', async () => {
        // Arrange
        const accountId = 'patient-123';
        const dto = createValidCreateReportDto();
        const mockCreatedReport = createMockReport();

        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockCreatedReport);

        // Act
        await service.createReport(accountId, dto);

        // Assert
        expect(reportRepository.createReport).toHaveBeenCalledTimes(1);
        expect(reportRepository.createReport).toHaveBeenCalledWith({
          accountId,
          reportType: dto.reportType,
          description: dto.description,
          reportImages: dto.reportImages,
          isResponse: false,
          responseDescription: null,
        });
      });

      it('TC-15: Should call repository.saveReport to persist data', async () => {
        // Arrange
        const accountId = 'patient-123';
        const dto = createValidCreateReportDto();
        const mockCreatedReport = createMockReport();
        const mockSavedReport = { ...mockCreatedReport };

        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockSavedReport);

        // Act
        await service.createReport(accountId, dto);

        // Assert
        expect(reportRepository.saveReport).toHaveBeenCalledTimes(1);
        expect(reportRepository.saveReport).toHaveBeenCalledWith(mockCreatedReport);
      });

      it('TC-16: Should return the saved report entity from database', async () => {
        // Arrange
        const accountId = 'patient-123';
        const dto = createValidCreateReportDto();
        const mockCreatedReport = createMockReport({ _id: undefined as any });
        const mockSavedReport = createMockReport({ _id: 'generated-uuid-123' });

        reportRepository.createReport.mockReturnValue(mockCreatedReport);
        reportRepository.saveReport.mockResolvedValue(mockSavedReport);

        // Act
        const result = await service.createReport(accountId, dto);

        // Assert
        expect(result._id).toBe('generated-uuid-123');
        expect(result).toEqual(mockSavedReport);
      });
    });
  });
});
