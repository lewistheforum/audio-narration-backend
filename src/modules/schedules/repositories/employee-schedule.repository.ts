import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EmployeeSchedule } from '../entities/employee-schedule.entity';
import { ClinicShiftHour } from '../entities/clinic-shift-hour.entity';
import { WeekDay } from '../enums';
import { getEndOfMonth, getStartOfMonth } from 'src/common/utils/date.util';

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
      roomId?: string;
      shiftId?: string;
      role?: string;
    },
  ): Promise<EmployeeSchedule[]> {
    const queryBuilder = this.createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.employee', 'employee')
      .leftJoinAndSelect('schedule.clinicShift', 'clinicShift')
      .leftJoinAndSelect('clinicShift.hours', 'clinicShiftHour')
      .leftJoinAndSelect('schedule.rooms', 'rooms')
      // Map doctor information manually
      .leftJoinAndMapOne(
        'employee.doctorInformation',
        'DoctorInformation',
        'doctorInfo',
        'doctorInfo.accountId = employee._id',
      )
      // Map staff information from GeneralAccount
      .leftJoinAndSelect('employee.generalAccount', 'generalAccount')
      // Map staff information from ClinicStaffInformation
      .leftJoinAndMapOne(
        'employee.clinicStaffInformation',
        'ClinicStaffInformation',
        'staffInfo',
        'staffInfo.accountId = employee._id',
      )
      .where('schedule.clinicId = :clinicId', { clinicId });

    if (options.role) {
      queryBuilder.andWhere('employee.role = :role', { role: options.role });
    }

    if (options.date) {
      if (options.date.length === 7) {
        // Handle YYYY-MM format by expanding to whole month
        queryBuilder.andWhere('schedule.workDate BETWEEN :start AND :end', {
          start: getStartOfMonth(options.date),
          end: getEndOfMonth(options.date),
        });
      } else {
        queryBuilder.andWhere('schedule.workDate = :date', {
          date: options.date,
        });
      }
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

    if (options.roomId) {
      queryBuilder.andWhere('rooms._id = :roomId', { roomId: options.roomId });
    }

    if (options.shiftId) {
      queryBuilder.andWhere('schedule.clinicShiftId = :shiftId', {
        shiftId: options.shiftId,
      });
    }

    return queryBuilder
      .orderBy('schedule.workDate', 'ASC')
      .addOrderBy('clinicShift.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Find Schedules Hours with Filters
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
  async findScheduleHours(
    clinicId: string,
    options: {
      date?: string;
      from?: string;
      to?: string;
      employeeId?: string;
      roomId?: string;
      shiftId?: string;
      role?: string;
    },
  ): Promise<any[]> {
    const queryBuilder = this.createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.employee', 'employee')
      .leftJoinAndSelect('schedule.clinicShift', 'clinicShift')
      .leftJoinAndSelect('clinicShift.hours', 'clinicShiftHour')
      .leftJoinAndSelect('schedule.rooms', 'rooms')
      // Map doctor information manually
      .leftJoinAndMapOne(
        'employee.doctorInformation',
        'DoctorInformation',
        'doctorInfo',
        'doctorInfo.accountId = employee._id',
      )
      // Map staff information from GeneralAccount
      .leftJoinAndSelect('employee.generalAccount', 'generalAccount')
      // Map staff information from ClinicStaffInformation
      .leftJoinAndMapOne(
        'employee.clinicStaffInformation',
        'ClinicStaffInformation',
        'staffInfo',
        'staffInfo.accountId = employee._id',
      )
      // Join appointments to count bookings per hour slot
      .leftJoin(
        'appointments',
        'appointment',
        'appointment.clinic_shift_hour_id = clinicShiftHour._id AND appointment.deleted_at IS NULL AND appointment.status != \'CANCELLED\'',
      )
      .addSelect('COUNT(appointment._id)', 'bookedCount')
      .where('schedule.clinicId = :clinicId', { clinicId })
      .groupBy('schedule._id')
      .addGroupBy('employee._id')
      .addGroupBy('clinicShift._id')
      .addGroupBy('clinicShiftHour._id')
      .addGroupBy('rooms._id')
      .addGroupBy('doctorInfo._id')
      .addGroupBy('generalAccount._id')
      .addGroupBy('staffInfo._id');

    if (options.role) {
      queryBuilder.andWhere('employee.role = :role', { role: options.role });
    }

    if (options.date) {
      if (options.date.length === 7) {
        // Handle YYYY-MM format by expanding to whole month
        queryBuilder.andWhere('schedule.workDate BETWEEN :start AND :end', {
          start: getStartOfMonth(options.date),
          end: getEndOfMonth(options.date),
        });
      } else {
        queryBuilder.andWhere('schedule.workDate = :date', {
          date: options.date,
        });
      }
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

    if (options.roomId) {
      queryBuilder.andWhere('rooms._id = :roomId', { roomId: options.roomId });
    }

    if (options.shiftId) {
      queryBuilder.andWhere('schedule.clinicShiftId = :shiftId', {
        shiftId: options.shiftId,
      });
    }

    return queryBuilder
      .orderBy('schedule.workDate', 'ASC')
      .addOrderBy('clinicShift.createdAt', 'ASC')
      .addOrderBy('clinicShiftHour.startHour', 'ASC')
      .getRawAndEntities()
      .then(({ raw, entities }) => {
        // Map raw bookedCount back into the entities
        return entities.map(entity => {
          // Find matching raw rows to attach bookedCount to the corresponding hours
          if (entity.clinicShift && entity.clinicShift.hours) {
            entity.clinicShift.hours = entity.clinicShift.hours.map(hour => {
              const rawRow = raw.find(
                r => r.schedule__id === entity._id && r.clinicShiftHour__id === hour._id
              );
              return {
                ...hour,
                bookedCount: rawRow ? parseInt(rawRow.bookedCount, 10) : 0
              };
            });
          }
          return entity;
        });
      });
  }

  /**
   * Find Schedule Conflict
   *
   * Checks if a schedule already exists for a specific employee on a specific date and shift.
   * Now updated to check for ANY overlapping time hours, even if Shift IDs are different.
   *
   * @param employeeId - ID of the employee
   * @param workDate - Date of work
   * @param clinicShiftId - ID of the shift (to get its base hours)
   * @param excludeId - (Optional) ID of a schedule to exclude (for update checks)
   * @returns Matching EmployeeSchedule or null
   */
  async findConflict(
    employeeId: string,
    workDate: Date,
    clinicShiftId: string,
    excludeId?: string,
  ): Promise<EmployeeSchedule | null> {
    // 1. Get the start and end hours for the requested clinicShiftId
    const shiftHours = await this.dataSource
      .getRepository(ClinicShiftHour)
      .createQueryBuilder('hour')
      .where('hour.shiftId = :clinicShiftId', { clinicShiftId })
      .orderBy('hour.startHour', 'ASC')
      .getMany();

    if (shiftHours.length === 0) return null;

    const firstHour = shiftHours[0].startHour;
    const lastHour = shiftHours[shiftHours.length - 1].endHour;

    // 2. Query for ANY existing schedule on same date/employee whose hours overlap
    const queryBuilder = this.createQueryBuilder('schedule')
      .innerJoin('schedule.clinicShift', 'shift')
      .innerJoin('shift.hours', 'existingHour')
      .where('schedule.employeeId = :employeeId', { employeeId })
      .andWhere('schedule.workDate = :workDate', { workDate })
      .andWhere('schedule.deletedAt IS NULL')
      .andWhere(
        '(existingHour.startHour < :lastHour AND existingHour.endHour > :firstHour)',
        { firstHour, lastHour },
      );

    if (excludeId) {
      queryBuilder.andWhere('schedule._id != :excludeId', { excludeId });
    }

    return queryBuilder.getOne();
  }

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
   * Find clinic rooms for multiple appointments
   *
   * Uses clinic_shift_hour_id to find rooms via the chain:
   * appointment → clinic_shift_hour → clinic_shift → employee_schedule → clinic_room_employee_schedule → clinic_rooms
   *
   * @param appointmentData - Array of {appointmentId, clinicShiftHourId, doctorId, appointmentDate}
   * @returns Map of appointmentId to clinic rooms array
   */
  async findClinicRoomsForMultipleAppointments(
    appointmentData: Array<{
      appointmentId: string;
      clinicShiftHourId: string | null;
      doctorId: string | null;
      appointmentDate: Date;
    }>,
  ): Promise<Map<string, any[]>> {
    if (appointmentData.length === 0) {
      return new Map();
    }

    // Filter only appointments with clinic_shift_hour_id
    const validAppointments = appointmentData.filter(
      (a) => a.clinicShiftHourId && a.doctorId,
    );

    if (validAppointments.length === 0) {
      return new Map();
    }

    // Build OR conditions for each appointment
    // Filter by work_date to get the correct room for that specific day
    const conditions = validAppointments
      .map(
        (_, index) =>
          `(a._id = :aptId${index} AND a.clinic_shift_hour_id = :shiftHourId${index} AND es.employee_id = :doctorId${index} AND es.work_date = a.appointment_date)`,
      )
      .join(' OR ');

    // Build parameters object
    const parameters: any = {};
    validAppointments.forEach((apt, index) => {
      parameters[`aptId${index}`] = apt.appointmentId;
      parameters[`shiftHourId${index}`] = apt.clinicShiftHourId;
      parameters[`doctorId${index}`] = apt.doctorId;
    });

    const queryBuilder = this.dataSource
      .createQueryBuilder()
      .select('a._id', 'appointmentId')
      .addSelect('a.appointment_date', 'appointmentDate')
      .addSelect('es.work_date', 'workDate')
      .addSelect('cr._id', 'roomId')
      .addSelect('cr.room_name', 'roomName')
      .from('appointments', 'a')
      .innerJoin('clinic_shift_hour', 'csh', 'csh._id = a.clinic_shift_hour_id')
      .innerJoin('clinic_shift', 'cs', 'cs._id = csh.shift_id')
      .innerJoin('employee_schedule', 'es', 'es.clinic_shift_id = cs._id')
      .innerJoin(
        'clinic_room_employee_schedule',
        'cres',
        'cres.employee_schedule_id = es._id',
      )
      .innerJoin('clinic_room', 'cr', 'cr._id = cres.clinic_room_id')
      .where(conditions, parameters)
      .andWhere('a.deleted_at IS NULL')
      .andWhere('es.deleted_at IS NULL')
      .andWhere('cr.deleted_at IS NULL');

    const result = await queryBuilder.getRawMany();

    // Group by appointmentId
    const roomsMap = new Map<string, any[]>();
    result.forEach((row) => {
      const appointmentId = row.appointmentId;
      const room = {
        id: row.roomId,
        roomName: row.roomName,
      };

      if (!roomsMap.has(appointmentId)) {
        roomsMap.set(appointmentId, []);
      }
      roomsMap.get(appointmentId)!.push(room);
    });

    return roomsMap;
  }

  /**
   * Find Room Conflict
   *
   * Checks if a room is already assigned to any doctor on a specific date during overlapping hours.
   *
   * @param roomId - ID of the room
   * @param workDate - Date of work
   * @param clinicShiftId - ID of the shift (to get its base hours)
   * @param excludeId - (Optional) ID of a schedule to exclude
   * @returns Matching EmployeeSchedule or null
   */
  async findRoomConflict(
    roomId: string,
    workDate: Date,
    clinicShiftId: string,
    excludeId?: string,
  ): Promise<EmployeeSchedule | null> {
    // 1. Get the range for requested shift
    const shiftHours = await this.dataSource
      .getRepository(ClinicShiftHour)
      .createQueryBuilder('hour')
      .where('hour.shiftId = :clinicShiftId', { clinicShiftId })
      .orderBy('hour.startHour', 'ASC')
      .getMany();

    if (shiftHours.length === 0) return null;

    const firstHour = shiftHours[0].startHour;
    const lastHour = shiftHours[shiftHours.length - 1].endHour;

    // 2. Query for ANY existing schedule on same date/room whose hours overlap
    const queryBuilder = this.createQueryBuilder('schedule')
      .innerJoin('schedule.rooms', 'room')
      .innerJoin('schedule.clinicShift', 'shift')
      .innerJoin('shift.hours', 'existingHour')
      .where('room._id = :roomId', { roomId })
      .andWhere('schedule.workDate = :workDate', { workDate })
      .andWhere('schedule.deletedAt IS NULL')
      .andWhere(
        '(existingHour.startHour < :lastHour AND existingHour.endHour > :firstHour)',
        { firstHour, lastHour },
      );

    if (excludeId) {
      queryBuilder.andWhere('schedule._id != :excludeId', { excludeId });
    }

    return queryBuilder.getOne();
  }
}
