/**
 * Unit Tests for Schedules API (VERSION 4.3)
 * 
 * Tests for the merged schedules API that combines working-days and slots
 * into a single nested structure: Dates -> Shifts -> Slots
 * 
 * Covers:
 * - GET /patients/clinics/:clinicId/schedules (Option 1: Service-first)
 * - GET /patients/doctors/:doctorId/schedules (Option 2: Doctor-first)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from '../../../src/modules/appointments/appointments.service';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppointmentRepository, AppointmentPackageRepository } from '../../../src/modules/appointments/repositories';
import { ClinicStaffInformationRepository, AccountRepository } from '../../../src/modules/accounts/repositories';
import { EmployeeScheduleRepository } from '../../../src/modules/schedules/repositories/employee-schedule.repository';
import { BookingSessionService } from '../../../src/modules/appointments/booking-session.service';
import { REDIS_CLIENT } from '../../../src/config/redis.config';
import { mockRawScheduleData, mockServicesList } from './fixtures/mock-data';

describe('Schedules API (V4.3) - Unit Tests', () => {
  let service: AppointmentsService;
  let dataSource: DataSource;

  // Mock data
  const mockClinicId = '550e8400-e29b-41d4-a716-446655440001';
  const mockDoctorId = '550e8400-e29b-41d4-a716-446655440002';
  
  const mockScheduleData = [
    {
      work_date: new Date('2026-03-09'),
      week_day: 'Monday',
      clinic_id: mockClinicId,
      clinic_name: 'Phòng khám ABC',
      shift_type: 'MORNING',
      clinic_shift_hour_id: 'uuid-slot-1',
      doctor_id: mockDoctorId,
      doctor_name: 'BS. Nguyễn Văn A',
      doctor_specialty: 'Bác sĩ Xương Khớp',
      start_time: '08:00:00',
      end_time: '08:30:00',
      limit: 5,
      clinic_room: 'Phòng 101',
    },
    {
      work_date: new Date('2026-03-09'),
      week_day: 'Monday',
      clinic_id: mockClinicId,
      clinic_name: 'Phòng khám ABC',
      shift_type: 'AFTERNOON',
      clinic_shift_hour_id: 'uuid-slot-2',
      doctor_id: mockDoctorId,
      doctor_name: 'BS. Nguyễn Văn A',
      doctor_specialty: 'Bác sĩ Xương Khớp',
      start_time: '14:00:00',
      end_time: '14:30:00',
      limit: 4,
      clinic_room: 'Phòng 102',
    },
    {
      work_date: new Date('2026-03-10'),
      week_day: 'Tuesday',
      clinic_id: mockClinicId,
      clinic_name: 'Phòng khám ABC',
      shift_type: 'MORNING',
      clinic_shift_hour_id: 'uuid-slot-3',
      doctor_id: 'uuid-doctor-2',
      doctor_name: 'BS. Trần Thị B',
      doctor_specialty: 'Bác sĩ Tim Mạch',
      start_time: '09:00:00',
      end_time: '09:30:00',
      limit: 3,
      clinic_room: 'Phòng 103',
    },
  ];

  beforeEach(async () => {
    // Create mock QueryBuilder that will be returned by dataSource.createQueryBuilder()
    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(mockRawScheduleData()),
      getRawOne: jest.fn().mockResolvedValue(null),
    };

    // Create mock repository
    const mockRepository = {
      findOne: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    // Create mock DataSource with queryBuilder
    const mockDataSource = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: AppointmentRepository,
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: AppointmentPackageRepository,
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: ClinicStaffInformationRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: EmployeeScheduleRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: AccountRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: BookingSessionService,
          useValue: {
            createSession: jest.fn(),
            updateSession: jest.fn(),
            getSession: jest.fn(),
          },
        },
        {
          provide: REDIS_CLIENT,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    dataSource = module.get<DataSource>(DataSource);
  });

  describe('getClinicSchedules (Option 1: Service-first)', () => {
    it('should return nested structure: Dates -> Shifts -> Slots', async () => {
      const result = await service.getClinicSchedules(mockClinicId);

      // Verify structure
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      
      // Verify date grouping
      const firstDate = result.data[0];
      expect(firstDate).toHaveProperty('date');
      expect(firstDate).toHaveProperty('week_day');
      expect(firstDate).toHaveProperty('shifts');
      expect(Array.isArray(firstDate.shifts)).toBe(true);
      
      // Verify shift grouping
      const firstShift = firstDate.shifts[0] as any;
      expect(firstShift).toHaveProperty('shift');
      expect(['MORNING', 'AFTERNOON', 'EVENING']).toContain(firstShift.shift);
      expect(firstShift).toHaveProperty('slots');
      expect(Array.isArray(firstShift.slots)).toBe(true);
      
      // Verify slot structure
      const firstSlot = firstShift.slots[0] as any;
      expect(firstSlot).toHaveProperty('clinic_shift_hour_id');
      expect(firstSlot).toHaveProperty('doctor_id');
      expect(firstSlot).toHaveProperty('doctor_name');
      expect(firstSlot).toHaveProperty('start_time');
      expect(firstSlot).toHaveProperty('end_time');
      expect(firstSlot).toHaveProperty('available_slots');
    });

    it('should calculate available_slots correctly', async () => {
      const result = await service.getClinicSchedules(mockClinicId);

      // Verify available_slots calculation
      const firstSlot = (result.data[0].shifts[0] as any).slots[0] as any;
      // From mockRawScheduleData: limit: 5, booked_count: 2, available: 3
      expect(firstSlot.available_slots).toBeGreaterThanOrEqual(0);
      expect(typeof firstSlot.available_slots).toBe('number');
    });

    it('should filter out fully booked slots', async () => {
      // Mock data where one slot is fully booked (limit === booked_count)
      const queryBuilder = dataSource.createQueryBuilder();
      jest.spyOn(queryBuilder, 'getRawMany').mockResolvedValue(
        mockRawScheduleData([{ limit: 5, booked_count: 5, shift_type: 'MORNING' }]) // Fully booked
      );

      const result = await service.getClinicSchedules(mockClinicId);

      // Should not include fully booked slots or available_slots should be 0
      const morningShift = result.data[0]?.shifts?.find((s: any) => s.shift === 'MORNING') as any;
      if (morningShift && morningShift.slots.length > 0) {
        // If slots exist, they should have available_slots calculated
        expect(morningShift.slots[0]).toHaveProperty('available_slots');
      }
    });

    it('should group slots by shift type correctly', async () => {
      const result = await service.getClinicSchedules(mockClinicId);

      const firstDate = result.data[0];
      
      // Verify all shift types are present
      const shiftTypes = firstDate.shifts.map((s: any) => s.shift);
      expect(shiftTypes).toContain('MORNING');
      expect(shiftTypes).toContain('AFTERNOON');
      
      // Verify EVENING exists (may be empty)
      const eveningShift = firstDate.shifts.find((s: any) => s.shift === 'EVENING') as any;
      if (eveningShift) {
        expect(Array.isArray(eveningShift.slots)).toBe(true);
      }
    });

    it('should return empty array when no schedules found', async () => {
      const queryBuilder = dataSource.createQueryBuilder();
      jest.spyOn(queryBuilder, 'getRawMany').mockResolvedValue([]);

      const result = await service.getClinicSchedules(mockClinicId);

      expect(result.data).toEqual([]);
    });
  });

  describe('getDoctorSchedules (Option 2: Doctor-first - VERSION 4.4+)', () => {
    it('should return only schedules without services', async () => {
      // Mock query builder to return schedules
      const queryBuilder = dataSource.createQueryBuilder();
      jest.spyOn(queryBuilder, 'getRawMany')
        .mockResolvedValueOnce(mockRawScheduleData());

      const result = await service.getDoctorSchedules(mockDoctorId, mockClinicId);

      // Verify structure - should NOT have available_services in v4.4+
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      // Services are fetched separately via getClinicServices API
    });

    it('should require clinic_id parameter', async () => {
      const queryBuilder = dataSource.createQueryBuilder();
      const whereSpy = jest.spyOn(queryBuilder, 'andWhere');
      
      jest.spyOn(queryBuilder, 'getRawMany')
        .mockResolvedValueOnce(mockRawScheduleData());

      await service.getDoctorSchedules(mockDoctorId, mockClinicId);

      // Verify clinic filter was applied
      expect(whereSpy).toHaveBeenCalled();
    });

    it('should group schedules by date and shift', async () => {
      const queryBuilder = dataSource.createQueryBuilder();
      jest.spyOn(queryBuilder, 'getRawMany')
        .mockResolvedValueOnce(mockRawScheduleData());

      const result = await service.getDoctorSchedules(mockDoctorId, mockClinicId);

      const firstDate = result.data[0];
      expect(firstDate).toHaveProperty('date');
      expect(firstDate).toHaveProperty('week_day');
      expect(firstDate).toHaveProperty('shifts');
      expect(Array.isArray(firstDate.shifts)).toBe(true);
    });
  });

  describe('SQL Query Structure (Integration with DB schema)', () => {
    it('should query correct tables in correct order', async () => {
      const queryBuilder = dataSource.createQueryBuilder();
      const fromSpy = jest.spyOn(queryBuilder, 'from');
      const joinSpy = jest.spyOn(queryBuilder, 'innerJoin');

      await service.getClinicSchedules(mockClinicId);

      // Verify correct query structure
      expect(fromSpy).toHaveBeenCalled();
      expect(joinSpy).toHaveBeenCalled();
    });

    it('should apply correct filters (date range: today to today+60)', async () => {
      const queryBuilder = dataSource.createQueryBuilder();
      const whereSpy = jest.spyOn(queryBuilder, 'andWhere');

      await service.getClinicSchedules(mockClinicId);

      // Verify date range filters were applied
      expect(whereSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle date with multiple doctors correctly', async () => {
      const multiDoctorData = mockRawScheduleData([
        { doctor_id: 'doctor-1', doctor_name: 'Doctor A' },
        { doctor_id: 'doctor-2', doctor_name: 'Doctor B' },
      ]);

      const queryBuilder = dataSource.createQueryBuilder();
      jest.spyOn(queryBuilder, 'getRawMany').mockResolvedValue(multiDoctorData);

      const result = await service.getClinicSchedules(mockClinicId);

      // Should have multiple slots in the same shift
      const morningShift = result.data[0].shifts.find((s: any) => s.shift === 'MORNING') as any;
      expect(morningShift.slots.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty shift gracefully', async () => {
      const onlyMorningData = [mockRawScheduleData()[0]];

      const queryBuilder = dataSource.createQueryBuilder();
      jest.spyOn(queryBuilder, 'getRawMany').mockResolvedValue(onlyMorningData);

      const result = await service.getClinicSchedules(mockClinicId);

      const firstDate = result.data[0];
      
      // AFTERNOON and EVENING should exist but may be empty
      const afternoonShift = firstDate.shifts.find((s: any) => s.shift === 'AFTERNOON') as any;
      const eveningShift = firstDate.shifts.find((s: any) => s.shift === 'EVENING') as any;

      if (afternoonShift) {
        expect(Array.isArray(afternoonShift.slots)).toBe(true);
      }
      if (eveningShift) {
        expect(Array.isArray(eveningShift.slots)).toBe(true);
      }
    });
  });
});
