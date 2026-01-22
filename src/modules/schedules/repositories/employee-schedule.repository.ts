import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmployeeSchedule } from '../entities/employee-schedule.entity';

/**
 * EmployeeSchedule Repository
 *
 * Handles database operations for EmployeeSchedule entity
 */
@Injectable()
export class EmployeeScheduleRepository {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Find clinic rooms for doctor on specific date
   *
   * @param doctorId - Doctor account UUID
   * @param workDate - Work date
   * @returns ClinicRoom array or empty array
   */
  async findClinicRoomsByDoctorAndDate(
    doctorId: string,
    workDate: Date,
  ): Promise<any[]> {
    const result = await this.dataSource
      .createQueryBuilder()
      .select('room._id', 'id')
      .addSelect('room.room_name', 'roomName')
      .from(EmployeeSchedule, 'schedule')
      .innerJoin('schedule.rooms', 'room')
      .where('schedule.employee_id = :doctorId', { doctorId })
      .andWhere('schedule.work_date = :workDate', { workDate })
      .andWhere('schedule.deletedAt IS NULL')
      .andWhere('room.deletedAt IS NULL')
      .getRawMany();

    return result;
  }
}
