import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SchedulesService } from '../../../src/modules/schedules/schedules.service';
import { EmployeeScheduleRepository } from '../../../src/modules/schedules/repositories/employee-schedule.repository';
import { ClinicShift } from '../../../src/modules/schedules/entities/clinic-shift.entity';
import { ClinicRoom } from '../../../src/modules/schedules/entities/clinic_room.entity';
import { Account } from '../../../src/modules/accounts/entities/accounts.entity';
import { DoctorInformation } from '../../../src/modules/accounts/entities/doctor_information.entity';
import { GeneralAccount } from '../../../src/modules/accounts/entities/general_accounts.entity';
import { ClinicStaffInformation } from '../../../src/modules/accounts/entities/clinic_staff_information.entity';
import { CreateScheduleDto } from '../../../src/modules/schedules/dto/create-schedule.dto';
import { AccountRole } from '../../../src/modules/accounts/enums/account-role.enum';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { WeekDay } from '../../../src/modules/schedules/enums';

describe('SchedulesService', () => {
    let service: SchedulesService;
    let mockAccountRepository = { findOne: jest.fn(), find: jest.fn() };
    let mockScheduleRepository = { findConflict: jest.fn(), findRoomConflict: jest.fn() };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SchedulesService,
                { provide: EmployeeScheduleRepository, useValue: mockScheduleRepository },
                { provide: getRepositoryToken(ClinicShift), useValue: {} },
                { provide: getRepositoryToken(ClinicRoom), useValue: {} },
                { provide: getRepositoryToken(Account), useValue: mockAccountRepository },
                { provide: getRepositoryToken(DoctorInformation), useValue: {} },
                { provide: getRepositoryToken(GeneralAccount), useValue: {} },
                { provide: getRepositoryToken(ClinicStaffInformation), useValue: {} },
                { provide: DataSource, useValue: { createQueryRunner: jest.fn() } },
            ],
        }).compile();
        service = module.get<SchedulesService>(SchedulesService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
