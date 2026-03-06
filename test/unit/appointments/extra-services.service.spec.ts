// Mock uuid before any imports
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mocked-uuid-v4'),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from 'src/modules/appointments/appointments.service';
import { BookingSessionService } from 'src/modules/appointments/booking-session.service';
import { AppointmentRepository, AppointmentPackageRepository } from 'src/modules/appointments/repositories';
import { AccountRepository, ClinicStaffInformationRepository } from 'src/modules/accounts/repositories';
import { EmployeeScheduleRepository } from 'src/modules/schedules/repositories/employee-schedule.repository';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { REDIS_CLIENT } from 'src/config/redis.config';
import { AppointmentPackageStatus } from 'src/modules/appointments/enums';

describe('AppointmentsService - addExtraService', () => {
    let service: AppointmentsService;
    let appointmentRepo: any;
    let dataSource: any;
    let manager: any;

    beforeEach(async () => {
        appointmentRepo = {
            findOne: jest.fn(),
            update: jest.fn(),
        };

        manager = {
            getRepository: jest.fn().mockReturnValue({
                findOne: jest.fn(),
                create: jest.fn().mockImplementation(o => o),
                save: jest.fn().mockImplementation(o => ({ ...o, _id: 'new-id' })),
                update: jest.fn(),
            }),
        };

        dataSource = {
            transaction: jest.fn().mockImplementation(cb => cb(manager)),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AppointmentsService,
                { provide: BookingSessionService, useValue: {} },
                { provide: AppointmentRepository, useValue: appointmentRepo },
                { provide: AppointmentPackageRepository, useValue: {} },
                { provide: AccountRepository, useValue: {} },
                { provide: ClinicStaffInformationRepository, useValue: {} },
                { provide: EmployeeScheduleRepository, useValue: {} },
                { provide: DataSource, useValue: dataSource },
                { provide: REDIS_CLIENT, useValue: {} },
            ],
        }).compile();

        service = module.get<AppointmentsService>(AppointmentsService);
    });

    it('should successfully add an extra service', async () => {
        const appointmentId = 'apt-id';
        const serviceConfigId = 'svc-id';

        appointmentRepo.findOne.mockResolvedValue({
            _id: appointmentId,
            clinicId: 'clinic-id',
            total: 1000,
        });

        const mockServiceConfig = {
            _id: serviceConfigId,
            isActive: true,
            price: 500,
            discount: 10,
            service: { serviceName: 'Test Service' },
        };

        manager.getRepository.mockImplementation((entity) => {
            if (typeof entity === 'string' && entity === 'clinic_service_config') {
                return { findOne: jest.fn().mockResolvedValue(mockServiceConfig) };
            }
            return {
                create: jest.fn().mockImplementation(o => o),
                save: jest.fn().mockImplementation(o => ({ ...o, _id: 'generated-id' })),
                update: jest.fn().mockResolvedValue({}),
            };
        });

        const result = await service.addExtraService(appointmentId, serviceConfigId);

        expect(result.amount).toBe(450); // 500 - 10%
        expect(result.newTotal).toBe(1450); // 1000 + 450
        expect(result.serviceName).toBe('Test Service');
    });

    it('should throw NotFoundException if appointment is missing', async () => {
        appointmentRepo.findOne.mockResolvedValue(null);
        await expect(service.addExtraService('none', 'any')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if service is inactive', async () => {
        appointmentRepo.findOne.mockResolvedValue({ _id: 'id', clinicId: 'cid' });
        manager.getRepository.mockReturnValue({
            findOne: jest.fn().mockResolvedValue({ isActive: false }),
        });

        await expect(service.addExtraService('id', 'svc')).rejects.toThrow(BadRequestException);
    });
});
