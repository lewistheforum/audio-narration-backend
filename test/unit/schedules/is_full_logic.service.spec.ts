import { Test, TestingModule } from '@nestjs/testing';
import { SchedulesService } from 'src/modules/schedules/schedules.service';
import * as dateUtils from 'src/common/utils/date.util';
import { AccountRole } from 'src/modules/accounts/enums';
import { EmployeeScheduleRepository } from 'src/modules/schedules/repositories/employee-schedule.repository';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClinicShift } from 'src/modules/schedules/entities/clinic-shift.entity';
import { ClinicRoom } from 'src/modules/schedules/entities/clinic_room.entity';
import { Account } from 'src/modules/accounts/entities/accounts.entity';
import { DoctorInformation } from 'src/modules/accounts/entities/doctor_information.entity';
import { GeneralAccount } from 'src/modules/accounts/entities/general_accounts.entity';
import { ClinicStaffInformation } from 'src/modules/accounts/entities/clinic_staff_information.entity';
import { DataSource } from 'typeorm';

describe('SchedulesService - isFull Logic', () => {
  let service: SchedulesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulesService,
        { provide: EmployeeScheduleRepository, useValue: {} },
        { provide: getRepositoryToken(ClinicShift), useValue: {} },
        { provide: getRepositoryToken(ClinicRoom), useValue: {} },
        { provide: getRepositoryToken(Account), useValue: {} },
        { provide: getRepositoryToken(DoctorInformation), useValue: {} },
        { provide: getRepositoryToken(GeneralAccount), useValue: {} },
        { provide: getRepositoryToken(ClinicStaffInformation), useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<SchedulesService>(SchedulesService);
  });

  it('should correctly mark isFull based on bookedCount and startTime using string comparison', () => {
    // Mock now to be 2026-03-23 10:00:00
    const now = new Date('2026-03-23T10:00:00');
    jest.spyOn(dateUtils, 'getCurrentVietnamTime').mockReturnValue(now);
    jest.spyOn(dateUtils, 'formatToDateOnly').mockReturnValue('2026-03-23');
    jest.spyOn(dateUtils, 'formatToTimeOnly').mockReturnValue('10:00:00');

    const workDate = new Date('2026-03-23T00:00:00');
    
    const schedules = [
      {
        _id: '1',
        workDate,
        employee: { role: AccountRole.DOCTOR },
        clinicShift: {
          hours: [
            {
              _id: 'h1',
              startHour: '09:00', // Past ("10:00:00" > "09:00")
              endHour: '10:00',
              limit: 5,
              bookedCount: 0,
            },
            {
              _id: 'h2',
              startHour: '10:30', // Future ("10:00:00" > "10:30" is false)
              endHour: '11:30',
              limit: 5,
              bookedCount: 0,
            },
            {
              _id: 'h3',
              startHour: '11:00', // Future but Full
              endHour: '12:00',
              limit: 5,
              bookedCount: 5,
            },
            {
              _id: 'h4',
              startHour: '10:00:00', // Exactly now
              endHour: '11:00',
              limit: 5,
              bookedCount: 0,
            }
          ],
        },
      },
    ];

    const result = (service as any).mapSchedules(schedules);
    const hours = result[0].shift.hours;

    expect(hours.find(h => h.id === 'h1').isFull).toBe(true); // Past
    expect(hours.find(h => h.id === 'h2').isFull).toBe(false); // Future
    expect(hours.find(h => h.id === 'h3').isFull).toBe(true); // Full
    expect(hours.find(h => h.id === 'h4').isFull).toBe(false); // Exactly now (not >)
  });
});
