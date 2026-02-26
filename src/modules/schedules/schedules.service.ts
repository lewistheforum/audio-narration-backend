import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EmployeeSchedule } from './entities/employee-schedule.entity';
import { ClinicShift } from './entities/clinic-shift.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CopyScheduleDto } from './dto/copy-schedule.dto';
import { CreateClinicRoomDto } from './dto/create-clinic-room.dto';
import { UpdateClinicRoomDto } from './dto/update-clinic-room.dto';
import { ClinicRoomQueryDto } from './dto/clinic-room-query.dto';
import { WeekDay } from './enums';
import { ClinicRoom } from './entities/clinic_room.entity';
import { Account } from '../accounts/entities/accounts.entity';
import { DoctorInformation } from '../accounts/entities/doctor_information.entity';
import { AccountRole } from '../accounts/enums/account-role.enum';
import { EmployeeScheduleRepository } from './repositories/employee-schedule.repository';

@Injectable()
export class SchedulesService {
    constructor(
        private readonly scheduleRepository: EmployeeScheduleRepository,
        @InjectRepository(ClinicShift)
        private readonly shiftRepository: Repository<ClinicShift>,
        @InjectRepository(ClinicRoom)
        private readonly roomRepository: Repository<ClinicRoom>,
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>,
        @InjectRepository(DoctorInformation)
        private readonly doctorInfoRepository: Repository<DoctorInformation>,
        private readonly dataSource: DataSource,
    ) { }

    // ... (rest of methods)

    /**
     * Get Clinic Employees (Doctors & Staff)
     * 
     * Retrieves list of employees belonging to a clinic.
     * Resolves clinicId from User context.
     * Supports filtering by search term.
     * 
     * @param user - User context
     * @param search - Optional search term
     */
    async getEmployees(user: any, search?: string) {
        const clinicId = await this.resolveClinicId(user);
        if (!clinicId) return [];

        let targetManagerId: string;

        // Find Manager to find employees
        const manager = await this.accountRepository.findOne({
            where: {
                parentId: clinicId,
                role: AccountRole.CLINIC_MANAGER
            }
        });

        if (manager) {
            targetManagerId = manager._id;
        } else {
            const acc = await this.accountRepository.findOne({ where: { _id: clinicId } });
            if (acc && acc.role === AccountRole.CLINIC_MANAGER) {
                targetManagerId = clinicId;
            } else {
                return [];
            }
        }

        const employees = await this.accountRepository.find({
            where: {
                parentId: targetManagerId,
                role: In([AccountRole.DOCTOR, AccountRole.CLINIC_STAFF])
            },
            select: ['_id', 'username', 'role'] // No relations needed here
        });

        if (!employees.length) return [];

        // Manual Fetch DoctorInformation
        const employeeIds = employees.map(e => e._id);
        const doctorInfos = await this.doctorInfoRepository.find({
            where: { accountId: In(employeeIds) }
        });

        // Create Map for quick lookup
        const infoMap = new Map<string, DoctorInformation>();
        doctorInfos.forEach(info => {
            infoMap.set(info.accountId, info);
        });

        let results = employees.map(emp => {
            const info = infoMap.get(emp._id);
            return {
                id: emp._id,
                name: info?.fullName || emp.username,
                role: emp.role,
                username: emp.username
            };
        });

        if (search) {
            const searchLower = search.toLowerCase();
            results = results.filter(e =>
                (e.name && e.name.toLowerCase().includes(searchLower)) ||
                (e.username && e.username.toLowerCase().includes(searchLower))
            );
        }

        return results;
    }

    /**
     * Copy Schedule (List Based)
     * 
     * Copies schedules from a list of source dates to a target start date.
     * Maps source dates consecutively to target dates.
     * Skips duplicates/conflicts.
     * 
     * @param user - Request user (manager)
     * @param copyScheduleDto - Source dates and target date
     */
    async copySchedule(user: any, copyScheduleDto: CopyScheduleDto) {
        const { fromDates, targetDate } = copyScheduleDto;
        const clinicId = await this.resolveClinicId(user);

        if (!clinicId) throw new BadRequestException('Clinic ID is required');

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        let copiedCount = 0;
        let skippedCount = 0;

        try {
            const targetStartDateObj = new Date(targetDate);

            // Iterate through each source date
            for (let i = 0; i < fromDates.length; i++) {
                const sourceDateStr = fromDates[i];
                const sourceDateObj = new Date(sourceDateStr);

                // Calculate target date for this index (Consecutive)
                const currentTargetDate = new Date(targetStartDateObj);
                currentTargetDate.setDate(targetStartDateObj.getDate() + i);

                // Get source schedules
                const sourceSchedules = await this.scheduleRepository.find({
                    where: {
                        clinicId,
                        workDate: sourceDateObj,
                    },
                    relations: ['clinicShift', 'rooms', 'employee']
                });

                if (sourceSchedules.length === 0) continue;

                // WeekDay calculation for target
                const dayOfWeek = currentTargetDate.getDay();
                const weekDayMap = [
                    WeekDay.SUNDAY, WeekDay.MONDAY, WeekDay.TUESDAY, WeekDay.WEDNESDAY,
                    WeekDay.THURSDAY, WeekDay.FRIDAY, WeekDay.SATURDAY,
                ];
                const weekDay = weekDayMap[dayOfWeek];

                for (const schedule of sourceSchedules) {
                    // Check conflict in target
                    const conflict = await this.scheduleRepository.findConflict(
                        schedule.employeeId,
                        currentTargetDate,
                        schedule.clinicShiftId
                    );

                    if (conflict) {
                        skippedCount++;
                        continue;
                    }

                    // Clone
                    const newSchedule = queryRunner.manager.create(EmployeeSchedule, {
                        ...schedule,
                        _id: undefined, // ensure new ID
                        workDate: currentTargetDate,
                        weekDay: weekDay,
                        createdAt: undefined,
                        updatedAt: undefined,
                    });

                    await queryRunner.manager.save(newSchedule);
                    copiedCount++;
                }
            }

            await queryRunner.commitTransaction();
            return {
                message: 'Copy completed',
                copied: copiedCount,
                skipped: skippedCount
            };

        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Create Schedules (Bulk)
     * 
     * Creates multiple schedule entries for an employee at a specific clinic.
     * Manages validations for employee, clinic, shift, and room existence.
     * Checks for potential schedule conflicts before creation.
     * 
     * @param clinicId - ID of the clinic
     * @param createScheduleDto - Data transfer object containing schedule details
     * @returns Array of created EmployeeSchedule entities
     * @throws NotFoundException if related entities exist
     * @throws ConflictException if schedule overlap occurs
     */
    async create(clinicId: string, createScheduleDto: CreateScheduleDto) {
        const { employeeId, items } = createScheduleDto;

        if (!clinicId) throw new BadRequestException('Clinic ID is required');

        const employee = await this.accountRepository.findOne({ where: { _id: employeeId } });
        if (!employee) throw new NotFoundException('Employee not found');

        const clinic = await this.accountRepository.findOne({ where: { _id: clinicId } });
        if (!clinic) throw new NotFoundException('Clinic not found');

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const createdSchedules = [];

            for (const item of items) {
                const { clinicShiftId, workDate, roomId } = item;
                const workDateObj = new Date(workDate);

                // WeekDay calculation
                const dayOfWeek = workDateObj.getDay();
                const weekDayMap = [
                    WeekDay.SUNDAY, WeekDay.MONDAY, WeekDay.TUESDAY, WeekDay.WEDNESDAY,
                    WeekDay.THURSDAY, WeekDay.FRIDAY, WeekDay.SATURDAY,
                ];
                const weekDay = weekDayMap[dayOfWeek];

                // Validate Shift
                const shift = await this.shiftRepository.findOne({
                    where: { _id: clinicShiftId, clinicId },
                });
                if (!shift) throw new NotFoundException(`Shift ${clinicShiftId} not found`);

                // Validate Room
                let room = null;
                if (roomId) {
                    room = await this.roomRepository.findOne({
                        where: { _id: roomId, clinicId },
                    });
                    if (!room) throw new NotFoundException(`Room ${roomId} not found`);
                }

                // Conflict Check using Repository
                const conflict = await this.scheduleRepository.findConflict(
                    employeeId,
                    workDateObj,
                    clinicShiftId
                );

                if (conflict) {
                    throw new ConflictException(
                        `Schedule exists for Employee ${employeeId} on ${workDate} for Shift ${clinicShiftId}`
                    );
                }

                // Create
                const newSchedule = queryRunner.manager.create(EmployeeSchedule, {
                    clinicId,
                    employeeId,
                    clinicShiftId,
                    workDate: workDateObj,
                    weekDay,
                    rooms: room ? [room] : [], // Assign relation
                });

                const saved = await queryRunner.manager.save(newSchedule);
                createdSchedules.push(saved);
            }

            await queryRunner.commitTransaction();
            return createdSchedules;
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Helper to resolve Clinic ID from User Context
     */
    private async resolveClinicId(user: any): Promise<string | null> {
        if (user.role === AccountRole.CLINIC_MANAGER) {
            return user.parentId || user._id; // Fallback to self if root
        }

        if (user.role === AccountRole.DOCTOR || user.role === AccountRole.CLINIC_STAFF) {
            if (user.parentId) {
                const manager = await this.accountRepository.findOne({
                    where: { _id: user.parentId },
                });
                if (manager && manager.parentId) {
                    return manager.parentId;
                }
            }
        }
        return null;
    }

    /**
     * Find All Schedules (Role-based)
     * 
     * Retrieves schedules based on the requester's role and query filters.
     * - Managers: View all schedules for their clinic.
     * - Doctors/Staff: View all schedules for their clinic (Staff) or only their own (Doctor).
     * 
     * @param user - Create object comprising role and ID
     * @param query - Filter parameters (date, range, etc.)
     * @returns Filtered and mapped list of schedules
     */
    async findAll(user: any, query: any) {
        let clinicId = query.clinicId;
        let filterEmployeeId = query.employeeId;

        // Auto-resolve Clinic ID if not provided (or enforce it)
        const resolvedClinicId = await this.resolveClinicId(user);
        if (resolvedClinicId) {
            clinicId = resolvedClinicId;
        }

        // If Doctor, restrict to own schedule
        if (user.role === AccountRole.DOCTOR) {
            filterEmployeeId = user._id;
        }

        if (!clinicId) {
            // Fallback or Error? Ideally fallback to query param if user is Admin (not handled yet)
        }

        return this.mapSchedules(
            await this.scheduleRepository.findSchedules(clinicId, {
                date: query.date,
                from: query.from,
                to: query.to,
                employeeId: filterEmployeeId,
                roomId: query.roomId,
                shiftId: query.shiftId,
            })
        );
    }

    /**
     * Map Schedules Response
     * 
     * internal helper to transform entity structure to DTO response format
     */
    private mapSchedules(schedules: EmployeeSchedule[]) {
        return schedules.map((schedule) => {
            const emp: any = schedule.employee;
            const doctorInfo = emp?.doctorInformation;

            return {
                id: schedule._id,
                workDate: schedule.workDate,
                weekDay: schedule.weekDay,
                employee: {
                    id: emp?._id,
                    fullName: doctorInfo?.fullName || emp?.username || 'Unknown',
                    avatar: doctorInfo?.profilePicture || null,
                },
                shift: {
                    id: schedule.clinicShift?._id,
                    name: schedule.clinicShift?.shift,
                },
                room: (schedule.rooms && schedule.rooms.length > 0)
                    ? {
                        id: schedule.rooms[0]._id,
                        name: schedule.rooms[0].roomName,
                    }
                    : null,
            };
        });
    }


    /**
     * Update Schedule
     * 
     * Updates an existing schedule identified by ID.
     * Checks for conflicts if critical fields (Shift, Date, Employee) are changed.
     * 
     * @param id - UUID of schedule
     * @param updateScheduleDto - Fields to update
     * @returns Success message
     */
    async update(id: string, updateScheduleDto: UpdateScheduleDto) {
        const { clinicShiftId, workDate, roomId, employeeId } = updateScheduleDto;

        const schedule = await this.scheduleRepository.findOne({ where: { _id: id } });
        if (!schedule) throw new NotFoundException('Schedule not found');

        // Logic check: Validate new Foreign Keys (Employee, Shift) if changed...
        // ... (Skipping verbose checks for brevity, rely on existing logic or constraints)

        if (workDate) {
            schedule.workDate = new Date(workDate);
            const dayOfWeek = schedule.workDate.getDay();
            const weekDayMap = [
                WeekDay.SUNDAY, WeekDay.MONDAY, WeekDay.TUESDAY, WeekDay.WEDNESDAY,
                WeekDay.THURSDAY, WeekDay.FRIDAY, WeekDay.SATURDAY,
            ];
            schedule.weekDay = weekDayMap[dayOfWeek];
        }

        if (employeeId) schedule.employeeId = employeeId;
        if (clinicShiftId) schedule.clinicShiftId = clinicShiftId;

        // Update Room if provided
        if (roomId) {
            const room = await this.roomRepository.findOne({
                where: { _id: roomId, clinicId: schedule.clinicId }
            });
            if (!room) throw new NotFoundException('Clinic Room not found');
            schedule.rooms = [room];
        }

        // Conflict Check on Update
        if (clinicShiftId || workDate || employeeId) {
            const conflict = await this.scheduleRepository.findConflict(
                schedule.employeeId,
                schedule.workDate,
                schedule.clinicShiftId,
                id // exclude current
            );
            if (conflict) {
                throw new ConflictException('Update failed: Schedule conflict detected');
            }
        }

        await this.scheduleRepository.save(schedule);
        return { message: 'Schedule updated successfully' };
    }

    /**
     * Remove Schedule
     * 
     * Soft deletes a schedule.
     * 
     * @param id - UUID of schedule to delete
     * @returns Success message
     */
    async remove(id: string) {
        const result = await this.scheduleRepository.softDelete(id);
        if (result.affected === 0) throw new NotFoundException('Schedule not found');
        return { message: 'Schedule deleted successfully' };
    }

    /**
     * Get Clinic Shifts
     * 
     * Helper to list all shifts for a clinic.
     */
    async getShifts(user: any) {
        const clinicId = await this.resolveClinicId(user);
        if (!clinicId) return [];

        return this.shiftRepository.find({
            where: { clinicId },
            select: ['_id', 'shift'],
            order: { shift: 'ASC' },
        });
    }

    /**
     * Get Clinic Rooms
     * 
     * Helper to list all rooms for a clinic.
     * Resolves clinicId from user if provided.
     */
    async getRooms(user: any) { // Changed to accept User
        const clinicId = await this.resolveClinicId(user);
        if (!clinicId) return [];

        return this.roomRepository.find({
            where: { clinicId },
            select: ['_id', 'roomName'],
            order: { roomName: 'ASC' },
        });
    }

    /**
     * ---------------------------------------------------------
     * CLINIC ROOM CRUD APIs
     * ---------------------------------------------------------
     */

    async createClinicRoom(user: any, dto: CreateClinicRoomDto) {
        const clinicId = await this.resolveClinicId(user);
        if (!clinicId) throw new BadRequestException('Clinic ID could not be resolved');

        const room = this.roomRepository.create({
            roomName: dto.roomName,
            clinicId,
        });

        return await this.roomRepository.save(room);
    }

    async getPaginatedClinicRooms(user: any, query: ClinicRoomQueryDto) {
        const clinicId = await this.resolveClinicId(user);
        if (!clinicId) throw new BadRequestException('Clinic ID could not be resolved');

        const { page = 1, limit = 10, search } = query;
        const skip = (page - 1) * limit;

        const qb = this.roomRepository.createQueryBuilder('room')
            .where('room.clinicId = :clinicId', { clinicId });

        if (search) {
            qb.andWhere('LOWER(room.roomName) LIKE LOWER(:search)', { search: `%${search}%` });
        }

        qb.orderBy('room.createdAt', 'DESC')
            .skip(skip)
            .take(limit);

        const [items, total] = await qb.getManyAndCount();

        return {
            items,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getClinicRoomById(id: string, user: any) {
        const clinicId = await this.resolveClinicId(user);
        if (!clinicId) throw new BadRequestException('Clinic ID could not be resolved');

        const room = await this.roomRepository.findOne({
            where: { _id: id, clinicId },
        });

        if (!room) throw new NotFoundException('Clinic room not found or you do not have permission');
        return room;
    }

    async updateClinicRoom(id: string, user: any, dto: UpdateClinicRoomDto) {
        const room = await this.getClinicRoomById(id, user);

        if (dto.roomName) {
            room.roomName = dto.roomName;
        }

        return await this.roomRepository.save(room);
    }

    async deleteClinicRoom(id: string, user: any) {
        const room = await this.getClinicRoomById(id, user);

        // Optional logic: Check if room is being used in an active EmployeeSchedule before deleting
        // ...

        const result = await this.roomRepository.softDelete(room._id);
        if (result.affected === 0) throw new NotFoundException('Failed to delete clinic room');
        return { message: 'Clinic room deleted successfully' };
    }


}
