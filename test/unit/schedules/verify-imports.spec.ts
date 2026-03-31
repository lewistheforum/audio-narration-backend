import { Test, TestingModule } from '@nestjs/testing';
import { SchedulesService } from 'src/modules/schedules/schedules.service';
import { EmployeeScheduleRepository } from 'src/modules/schedules/repositories/employee-schedule.repository';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClinicShift } from 'src/modules/schedules/entities/clinic-shift.entity';
import { ClinicRoom } from 'src/modules/schedules/entities/clinic_room.entity';
import { Account } from 'src/modules/accounts/entities/accounts.entity';
import { DoctorInformation } from 'src/modules/accounts/entities/doctor_information.entity';
import { GeneralAccount } from 'src/modules/accounts/entities/general_accounts.entity';
import { ClinicStaffInformation } from 'src/modules/accounts/entities/clinic_staff_information.entity';
import { AccountRole } from 'src/modules/accounts/enums/account-role.enum';
import { DataSource } from 'typeorm';

describe('SchedulesService Load', () => {
    it('should pass', () => {
        expect(1).toBe(1);
    });
});
