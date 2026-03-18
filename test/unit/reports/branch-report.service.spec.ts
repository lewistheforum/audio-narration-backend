import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BranchReportService } from '../../../src/modules/reports/branch-report.service';
import { Appointment } from '../../../src/modules/appointments/entities/appointment.entity';
import { AppointmentStatus } from '../../../src/modules/appointments/enums';
import { ReportPeriod } from '../../../src/modules/reports/dto/branch-report-query.dto';

describe('BranchReportService', () => {
  let service: BranchReportService;
  let dataSource: DataSource;

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
  };

  const mockRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockDataSource = {
    getRepository: jest.fn(() => mockRepository),
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchReportService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<BranchReportService>(BranchReportService);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCustomerStats', () => {
    it('should call query builder with correct grouping for daily period', async () => {
      const managerId = 'manager-id';
      const query = { period: ReportPeriod.DAY };
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.getCustomerStats(managerId, query);

      expect(dataSource.getRepository).toHaveBeenCalledWith(Appointment);
      expect(mockQueryBuilder.select).toHaveBeenCalledWith(
        "TO_CHAR(appointment_date, 'YYYY-MM-DD')",
        'label',
      );
      expect(mockQueryBuilder.addSelect).toHaveBeenCalledWith(
        'COUNT(DISTINCT appointment.patientId)',
        'count',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'appointment.clinicId = :managerId',
        { managerId },
      );
    });
  });

  describe('getDoctorsWorkingAndFeedback', () => {
it('should return combined doctor and feedback data', async () => {
      const managerId = 'manager-id';
      const date = '2026-03-17';
      const mockDoctors = [{ doctorId: 'doc-1', fullName: 'Dr. John' }];
      const mockStats = [{ avgRating: '4.50', totalFeedback: '10' }];
      const mockFeedbacks = [{ rating: 5, description: 'Great' }];

      (dataSource.query as jest.Mock)
        .mockResolvedValueOnce(mockDoctors)
        .mockResolvedValueOnce(mockStats)
        .mockResolvedValueOnce(mockFeedbacks);

      const result = await service.getDoctorsWorkingAndFeedback(managerId, date);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        doctorId: 'doc-1',
        avgRating: 4.5,
        totalFeedback: 10,
        recentFeedbacks: mockFeedbacks,
      });
    });
  });

  describe('getServiceStats', () => {
    it('should execute correct SQL for service statistics', async () => {
      const managerId = 'manager-id';
      (dataSource.query as jest.Mock).mockResolvedValue([
        { serviceName: 'Service A', registrationCount: '5', totalRevenue: '500.00' },
      ]);

      const result = await service.getServiceStats(managerId, {});

      expect(result[0]).toMatchObject({
        serviceName: 'Service A',
        registrationCount: 5,
        totalRevenue: 500.0,
      });
    });
  });
});
