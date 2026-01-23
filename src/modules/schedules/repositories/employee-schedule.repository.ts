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

  /**
   * Find clinic rooms for multiple doctor-date combinations
   *
   * @param doctorDatePairs - Array of {doctorId, appointmentDate} objects
   * @returns Map of "doctorId_date" to clinic rooms array
   */
  async findClinicRoomsForMultipleAppointments(
    doctorDatePairs: Array<{ doctorId: string; appointmentDate: Date }>,
  ): Promise<Map<string, any[]>> {
    if (doctorDatePairs.length === 0) {
      return new Map();
    }

    // Build OR conditions for each doctor-date pair
    const conditions = doctorDatePairs
      .map(
        (_, index) =>
          `(schedule.employee_id = :doctorId${index} AND schedule.work_date = :workDate${index})`,
      )
      .join(' OR ');

    // Build parameters object
    const parameters: any = {};
    doctorDatePairs.forEach((pair, index) => {
      parameters[`doctorId${index}`] = pair.doctorId;
      parameters[`workDate${index}`] = pair.appointmentDate;
    });

    const result = await this.dataSource
      .createQueryBuilder()
      .select('schedule.employee_id', 'doctorId')
      .addSelect('schedule.work_date', 'workDate')
      .addSelect('room._id', 'roomId')
      .addSelect('room.room_name', 'roomName')
      .from(EmployeeSchedule, 'schedule')
      .innerJoin('schedule.rooms', 'room')
      .where(conditions, parameters)
      .andWhere('schedule.deletedAt IS NULL')
      .andWhere('room.deletedAt IS NULL')
      .getRawMany();

    // Group by doctorId_date key
    const roomsMap = new Map<string, any[]>();
    result.forEach((row) => {
      const key = `${row.doctorId}_${row.workDate}`;
      const room = {
        id: row.roomId,
        roomName: row.roomName,
      };

      if (!roomsMap.has(key)) {
        roomsMap.set(key, []);
      }
      roomsMap.get(key)!.push(room);
    });

    return roomsMap;
  }
}
