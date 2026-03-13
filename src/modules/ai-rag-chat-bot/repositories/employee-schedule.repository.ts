import { Injectable } from '@nestjs/common';
import { EmployeeSchedule } from 'src/modules/schedules/entities';
import { DataSource, Repository } from 'typeorm';

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
      .leftJoinAndSelect('schedule.rooms', 'rooms')
      // Map doctor information manually
      .leftJoinAndMapOne(
        'employee.doctorInformation',
        'DoctorInformation',
        'doctorInfo',
        'doctorInfo.accountId = employee._id',
      )
      .where('schedule.clinicId = :clinicId', { clinicId });

    if (options.role) {
      queryBuilder.andWhere('employee.role = :role', { role: options.role });
    }

    if (options.date) {
      queryBuilder.andWhere('schedule.workDate = :date', {
        date: options.date,
      });
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
      // Join appointments to count bookings per hour slot
      .leftJoin(
        'appointments',
        'appointment',
        "appointment.clinic_shift_hour_id = clinicShiftHour._id AND appointment.deleted_at IS NULL AND appointment.status != 'CANCELLED'",
      )
      .addSelect('COUNT(appointment._id)', 'bookedCount')
      .where('schedule.clinicId = :clinicId', { clinicId })
      .groupBy('schedule._id')
      .addGroupBy('employee._id')
      .addGroupBy('clinicShift._id')
      .addGroupBy('clinicShiftHour._id')
      .addGroupBy('rooms._id')
      .addGroupBy('doctorInfo._id');

    if (options.role) {
      queryBuilder.andWhere('employee.role = :role', { role: options.role });
    }

    if (options.date) {
      queryBuilder.andWhere('schedule.workDate = :date', {
        date: options.date,
      });
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

    // Since we used aggregation, we should use getRawAndEntities to retrieve raw counts properly
    // However, it's cleaner to execute as raw when we introduce complex aggregations.
    return queryBuilder
      .orderBy('schedule.workDate', 'ASC')
      .addOrderBy('clinicShift.createdAt', 'ASC')
      .addOrderBy('clinicShiftHour.startHour', 'ASC')
      .getRawAndEntities()
      .then(({ raw, entities }) => {
        // Map raw bookedCount back into the entities
        return entities.map((entity) => {
          // Find matching raw rows to attach bookedCount to the corresponding hours
          if (entity.clinicShift && entity.clinicShift.hours) {
            entity.clinicShift.hours = entity.clinicShift.hours.map((hour) => {
              const rawRow = raw.find(
                (r) =>
                  r.schedule__id === entity._id &&
                  r.clinicShiftHour__id === hour._id,
              );
              return {
                ...hour,
                bookedCount: rawRow ? parseInt(rawRow.bookedCount, 10) : 0,
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
}
