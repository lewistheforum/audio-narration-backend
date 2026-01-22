import { Injectable, Logger } from '@nestjs/common';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRole } from '../../modules/accounts/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { ClinicRoom } from '../../modules/schedules/entities/clinic_room.entity';
import { EmployeeSchedule } from '../../modules/schedules/entities/employee-schedule.entity';
import { ClinicRoomRepository } from '../../modules/schedules/repositories/clinic-room.repository';
import { EmployeeScheduleRepository } from '../../modules/schedules/repositories/employee-schedule.repository';

/**
 * Clinic Room Employee Schedule Seeder Service
 *
 * Seeds the join table `clinic_room_employee_schedule` to assign rooms to employee schedules.
 *
 * Room Assignment Rules:
 * - For DOCTOR: assign 1 room per schedule (per shift/day)
 * - For CLINIC_STAFF: assign 1-3 rooms per schedule
 *
 * Idempotent: Checks if assignment exists by (employee_schedule_id, clinic_room_id).
 *
 * Seeding Order:
 * - Must run after AccountSeederService (DOCTOR and CLINIC_STAFF accounts must exist)
 * - Must run after ClinicRoomSeederService (rooms must exist)
 * - Must run after EmployeeScheduleSeederService (schedules must exist)
 */
@Injectable()
export class ClinicRoomEmployeeScheduleSeederService {
  private readonly logger = new Logger(
    ClinicRoomEmployeeScheduleSeederService.name,
  );

  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly clinicRoomRepository: ClinicRoomRepository,
    private readonly employeeScheduleRepository: EmployeeScheduleRepository,
  ) {}

  /**
   * Seed room assignments for all employee schedules
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed clinic room employee schedule assignments...');

      // Get all DOCTOR and CLINIC_STAFF accounts
      const allAccounts = await this.accountRepository.findAllAccounts();
      const employees = allAccounts.filter(
        (acc) =>
          acc.role === AccountRole.DOCTOR ||
          acc.role === AccountRole.CLINIC_STAFF,
      );

      if (employees.length === 0) {
        this.logger.warn(
          'No DOCTOR or CLINIC_STAFF accounts found. Skipping room assignment seeding.',
        );
        return;
      }

      let totalAssignmentsCreated = 0;

      for (const employee of employees) {
        const assignmentsCreated =
          await this.seedRoomAssignmentsForEmployee(employee);
        totalAssignmentsCreated += assignmentsCreated;
      }

      this.logger.log(
        `✅ Clinic room employee schedule assignment seeding completed. Created ${totalAssignmentsCreated} assignments total.`,
      );
    } catch (error) {
      this.logger.error('Failed to seed room assignments', error.stack);
      throw error;
    }
  }

  /**
   * Seed room assignments for a single employee
   *
   * @param employee - The DOCTOR or CLINIC_STAFF account
   * @returns Number of assignments created for this employee
   */
  private async seedRoomAssignmentsForEmployee(
    employee: Account,
  ): Promise<number> {
    // Derive clinic_id from employee's parent_id
    if (!employee.parentId) {
      this.logger.warn(
        `Employee ${employee._id} has no parent_id. Skipping room assignment seeding.`,
      );
      return 0;
    }

    // Get all rooms for this clinic
    const rooms = await this.clinicRoomRepository.find({
      where: { clinicId: employee.parentId },
    });

    if (rooms.length === 0) {
      this.logger.warn(
        `No rooms found for clinic ${employee.parentId}. Skipping employee ${employee._id}.`,
      );
      return 0;
    }

    // Get all schedules for this employee
    const schedules = await this.employeeScheduleRepository.find({
      where: { employeeId: employee._id },
    });

    if (schedules.length === 0) {
      this.logger.log(
        `No schedules found for employee ${employee._id}. Skipping room assignment seeding.`,
      );
      return 0;
    }

    this.logger.log(
      `Seeding room assignments for employee ${employee._id} (${employee.role})...`,
    );

    let createdCount = 0;

    for (const schedule of schedules) {
      const assignmentsCreated = await this.assignRoomsToSchedule(
        schedule,
        employee.role,
        rooms,
      );
      createdCount += assignmentsCreated;
    }

    this.logger.log(
      `✅ Created ${createdCount} room assignments for employee ${employee._id}`,
    );

    return createdCount;
  }

  /**
   * Assign rooms to a single employee schedule
   *
   * @param schedule - The EmployeeSchedule entity
   * @param role - The employee's role (DOCTOR or CLINIC_STAFF)
   * @param rooms - Available rooms for the clinic
   * @returns Number of assignments created for this schedule
   */
  private async assignRoomsToSchedule(
    schedule: EmployeeSchedule,
    role: AccountRole,
    rooms: ClinicRoom[],
  ): Promise<number> {
    // Determine number of rooms to assign based on role
    let roomsToAssign: number;

    if (role === AccountRole.DOCTOR) {
      // DOCTOR: assign 1 room per schedule
      roomsToAssign = 1;
    } else {
      // CLINIC_STAFF: assign 1-3 rooms per schedule
      roomsToAssign = this.getRandomInt(1, Math.min(3, rooms.length));
    }

    // Shuffle rooms to get random selection
    const shuffledRooms = this.shuffleArray([...rooms]);
    const selectedRooms = shuffledRooms.slice(0, roomsToAssign);

    let createdCount = 0;

    for (const room of selectedRooms) {
      // Check if assignment already exists
      const existingAssignment =
        await this.employeeScheduleRepository
          .createQueryBuilder('schedule')
          .leftJoin(
            'schedule.rooms',
            'room',
          )
          .where('schedule._id = :scheduleId', { scheduleId: schedule._id })
          .andWhere('room._id = :roomId', { roomId: room._id })
          .getOne();

      if (existingAssignment) {
        continue;
      }

      // Create the many-to-many relationship
      // We need to use the repository to save the relationship
      await this.employeeScheduleRepository
        .createQueryBuilder()
        .relation(EmployeeSchedule, 'rooms')
        .of(schedule)
        .add(room);

      createdCount++;
    }

    return createdCount;
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm
   *
   * @param array - The array to shuffle
   * @returns Shuffled array
   */
  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
