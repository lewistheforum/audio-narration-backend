import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EmployeeSchedule } from '../entities/employee-schedule.entity';
import { WeekDay } from '../enums';

@Injectable()
export class EmployeeScheduleRepository extends Repository<EmployeeSchedule> {
  constructor(private dataSource: DataSource) {
    super(EmployeeSchedule, dataSource.createEntityManager());
  }

  /**
   * Find Schedules with Filters
   * 
   * Retrieves a list of schedules based on clinic and additional filters.
   * Performs joins to include Employee, Shift, and Rooms data.
   * Manually maps DoctorInformation to the employee object.
   * 
   * @param clinicId - ID of the clinic to search within
   * @param options - Filter options:
   *   - date: specific work date
   *   - from/to: date range
   *   - employeeId: specific employee
   * @returns List of EmployeeSchedule entities with relations
   */
  async findSchedules(
    clinicId: string,
    options: {
      date?: string;
      from?: string;
      to?: string;
      employeeId?: string;
    },
  ): Promise<EmployeeSchedule[]> {
    const queryBuilder = this.createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.employee', 'employee')
      .leftJoinAndSelect('schedule.clinicShift', 'clinicShift')
      .leftJoinAndSelect('schedule.rooms', 'rooms')
      // Map doctor information manually
      .leftJoinAndMapOne(
        'employee.doctorInformation',
        'DoctorInformation',
        'doctorInfo',
        'doctorInfo.accountId = employee._id',
      )
      .where('schedule.clinicId = :clinicId', { clinicId });

    if (options.date) {
      queryBuilder.andWhere('schedule.workDate = :date', { date: options.date });
    }

    if (options.from && options.to) {
      queryBuilder.andWhere('schedule.workDate BETWEEN :from AND :to', {
        from: options.from,
        to: options.to,
      });
    }

    if (options.employeeId) {
      queryBuilder.andWhere('schedule.employeeId = :employeeId', {
        employeeId: options.employeeId,
      });
    }

    return queryBuilder
      .orderBy('schedule.workDate', 'ASC')
      .addOrderBy('clinicShift.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Find Schedule Conflict
   * 
   * Checks if a schedule already exists for a specific employee on a specific date and shift.
   * Used to prevent overlapping schedules during creation or update.
   * 
   * @param employeeId - ID of the employee
   * @param workDate - Date of work
   * @param clinicShiftId - ID of the shift
   * @param excludeId - (Optional) ID of a schedule to exclude (for update checks)
   * @returns Matching EmployeeSchedule or null
   */
  async findConflict(
    employeeId: string,
    workDate: Date,
    clinicShiftId: string,
    excludeId?: string,
  ): Promise<EmployeeSchedule | null> {
    const queryBuilder = this.createQueryBuilder('schedule')
      .where('schedule.employeeId = :employeeId', { employeeId })
      .andWhere('schedule.workDate = :workDate', { workDate })
      .andWhere('schedule.clinicShiftId = :clinicShiftId', { clinicShiftId });

    if (excludeId) {
      queryBuilder.andWhere('schedule._id != :excludeId', { excludeId });
    }

    return queryBuilder.getOne();
  }
}
