import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SchedulesService } from 'src/modules/schedules/schedules.service';
import { EmployeeScheduleRepository } from 'src/modules/schedules/repositories/employee-schedule.repository';
import { ClinicShift } from 'src/modules/schedules/entities/clinic-shift.entity';
import { ClinicRoom } from 'src/modules/schedules/entities/clinic_room.entity';
import { Account } from 'src/modules/accounts/entities/accounts.entity';
import { DoctorInformation } from 'src/modules/accounts/entities/doctor_information.entity';
import { GeneralAccount } from 'src/modules/accounts/entities/general_accounts.entity';
import { ClinicStaffInformation } from 'src/modules/accounts/entities/clinic_staff_information.entity';
import { CreateScheduleDto } from 'src/modules/schedules/dto/create-schedule.dto';
import { AccountRole } from 'src/modules/accounts/enums';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { WeekDay } from 'src/modules/schedules/enums';

describe('SchedulesService', () => {
    let service: SchedulesService;
    let scheduleRepository: EmployeeScheduleRepository;
    let shiftRepository: Repository<ClinicShift>;
    let roomRepository: Repository<ClinicRoom>;
    let accountRepository: Repository<Account>;
    let doctorInfoRepository: Repository<DoctorInformation>;
    let generalAccountRepository: Repository<GeneralAccount>;
    let clinicStaffRepository: Repository<ClinicStaffInformation>;
    let dataSource: DataSource;

    const mockScheduleRepository = {
        findSchedules: jest.fn(),
        findConflict: jest.fn(),
        findRoomConflict: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        softDelete: jest.fn(),
        find: jest.fn(),
    };

    const mockShiftRepository = {
        findOne: jest.fn(),
        find: jest.fn(),
    };

    const mockRoomRepository = {
        findOne: jest.fn(),
        find: jest.fn(),
    };

    const mockAccountRepository = {
        findOne: jest.fn(),
        find: jest.fn(),
    };

    const mockDoctorInfoRepository = {
        find: jest.fn(),
    };

    const mockGeneralAccountRepository = {
        find: jest.fn(),
    };

    const mockClinicStaffRepository = {
        find: jest.fn(),
    };

    const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
            create: jest.fn(),
            save: jest.fn(),
        },
    };

    const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
    };

    const mockDataSource = {
        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    beforeEach(async () => {
        mockScheduleRepository.findRoomConflict.mockResolvedValue(null);
        mockScheduleRepository.findConflict.mockResolvedValue(null);
        
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SchedulesService,
                {
                    provide: EmployeeScheduleRepository,
                    useValue: mockScheduleRepository,
                },
                {
                    provide: getRepositoryToken(ClinicShift),
                    useValue: mockShiftRepository,
                },
                {
                    provide: getRepositoryToken(ClinicRoom),
                    useValue: mockRoomRepository,
                },
                {
                    provide: getRepositoryToken(Account),
                    useValue: mockAccountRepository,
                },
                {
                    provide: getRepositoryToken(DoctorInformation),
                    useValue: mockDoctorInfoRepository,
                },
                {
                    provide: getRepositoryToken(GeneralAccount),
                    useValue: mockGeneralAccountRepository,
                },
                {
                    provide: getRepositoryToken(ClinicStaffInformation),
                    useValue: mockClinicStaffRepository,
                },
                {
                    provide: DataSource,
                    useValue: mockDataSource,
                },
            ],
        }).compile();

        service = module.get<SchedulesService>(SchedulesService);
        scheduleRepository = module.get<EmployeeScheduleRepository>(EmployeeScheduleRepository);
        shiftRepository = module.get<Repository<ClinicShift>>(getRepositoryToken(ClinicShift));
        roomRepository = module.get<Repository<ClinicRoom>>(getRepositoryToken(ClinicRoom));
        accountRepository = module.get<Repository<Account>>(getRepositoryToken(Account));
        doctorInfoRepository = module.get<Repository<DoctorInformation>>(getRepositoryToken(DoctorInformation));
        generalAccountRepository = module.get<Repository<GeneralAccount>>(getRepositoryToken(GeneralAccount));
        clinicStaffRepository = module.get<Repository<ClinicStaffInformation>>(getRepositoryToken(ClinicStaffInformation));
        dataSource = module.get<DataSource>(DataSource);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create schedules successfully', async () => {
            const clinicId = 'clinic-id';
            const createDto: CreateScheduleDto = {
                employeeId: 'emp-id',
                items: [
                    { clinicShiftId: 'shift-id', workDate: '2024-05-20', roomId: 'room-id' }
                ]
            };

            mockAccountRepository.findOne.mockResolvedValueOnce({ _id: 'emp-id' }); // Employee
            mockAccountRepository.findOne.mockResolvedValueOnce({ _id: 'clinic-id' }); // Clinic
            mockShiftRepository.findOne.mockResolvedValue({ _id: 'shift-id' });
            mockRoomRepository.findOne.mockResolvedValue({ _id: 'room-id' });
            mockScheduleRepository.findConflict.mockResolvedValue(null);

            const createdSchedule = { _id: 'sched-id' };
            mockQueryRunner.manager.create.mockReturnValue(createdSchedule);
            mockQueryRunner.manager.save.mockResolvedValue(createdSchedule);

            const result = await service.create(clinicId, createDto);

            expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
            expect(result).toEqual([createdSchedule]);
        });

        it('should throw ConflictException if schedule exists', async () => {
            const clinicId = 'clinic-id';
            const createDto: CreateScheduleDto = {
                employeeId: 'emp-id',
                items: [
                    { clinicShiftId: 'shift-id', workDate: '2024-05-20' }
                ]
            };

            mockAccountRepository.findOne.mockResolvedValue({ _id: 'id' });
            mockShiftRepository.findOne.mockResolvedValue({ _id: 'shift-id' });
            mockScheduleRepository.findConflict.mockResolvedValue({ _id: 'conflict-id' });

            await expect(service.create(clinicId, createDto)).rejects.toThrow(ConflictException);
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        });

        it('should throw ConflictException if room is already assigned to another doctor', async () => {
            const clinicId = 'clinic-id';
            const createDto: CreateScheduleDto = {
                employeeId: 'emp-id',
                items: [
                    { clinicShiftId: 'shift-id', workDate: '2024-05-20', roomId: 'occupied-room-id' }
                ]
            };

            mockAccountRepository.findOne.mockResolvedValueOnce({ _id: 'emp-id' });
            mockAccountRepository.findOne.mockResolvedValueOnce({ _id: 'clinic-id' });
            mockShiftRepository.findOne.mockResolvedValue({ _id: 'shift-id' });
            mockRoomRepository.findOne.mockResolvedValue({ _id: 'occupied-room-id' });
            mockScheduleRepository.findConflict.mockResolvedValue(null);
            mockScheduleRepository.findRoomConflict.mockResolvedValue({ _id: 'other-sched-id' }); // Conflict!

            await expect(service.create(clinicId, createDto)).rejects.toThrow(ConflictException);
            expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        });
    });

    describe('findAll', () => {
        it('should return mapped schedules for manager', async () => {
            const user = { _id: 'manager-id', role: AccountRole.CLINIC_MANAGER, parentId: 'clinic-id' };
            const query = { date: '2024-05-20' };

            const rawSchedules = [
                {
                    _id: 'sched-doctor',
                    workDate: new Date('2024-05-20'),
                    weekDay: WeekDay.MONDAY,
                    employee: {
                        _id: 'emp-doctor',
                        username: 'doc1',
                        role: AccountRole.DOCTOR,
                        doctorInformation: { fullName: 'Dr. House', profilePicture: 'pic.jpg' }
                    },
                    clinicShift: { _id: 'shift-id', shift: 'morning' },
                    rooms: [{ _id: 'room-1', roomName: 'Room 1' }]
                },
                {
                    _id: 'sched-staff',
                    workDate: new Date('2024-05-20'),
                    weekDay: WeekDay.MONDAY,
                    employee: {
                        _id: 'emp-staff',
                        username: 'staff1',
                        role: AccountRole.CLINIC_STAFF,
                        clinicStaffInformation: { fullName: 'Staff Mary', profilePicture: 'staff_pic.jpg' }
                    },
                    clinicShift: { _id: 'shift-id', shift: 'morning' },
                    rooms: [{ _id: 'room-2', roomName: 'Room 2' }]
                }
            ];

            mockScheduleRepository.findSchedules.mockResolvedValue(rawSchedules);

            const result = await service.findAll(user, query);

            expect(mockScheduleRepository.findSchedules).toHaveBeenCalledWith('manager-id', expect.objectContaining({ date: query.date }));
            expect(result).toHaveLength(2);
            // Doctor name from doctorInformation
            expect(result[0].employee.fullName).toEqual('Dr. House');
            // Staff name from ClinicStaffInformation
            expect(result[1].employee.fullName).toEqual('Staff Mary');
        });
    });

    describe('update', () => {
        it('should update schedule successfully if no existing appointments', async () => {
            const id = 'sched-id';
            const updateDto = { roomId: 'new-room-id' };
            const schedule = { _id: id, clinicId: 'clinic-id', rooms: [], workDate: new Date() };

            mockScheduleRepository.findOne.mockResolvedValue(schedule);
            mockRoomRepository.findOne.mockResolvedValue({ _id: 'new-room-id' });
            mockQueryBuilder.getRawMany.mockResolvedValue([]); // No existing appointments
            mockScheduleRepository.save.mockResolvedValue({ ...schedule, rooms: [{ _id: 'new-room-id' }] });

            const result = await service.update(id, updateDto);

            expect(mockScheduleRepository.save).toHaveBeenCalled();
            expect(result.message).toEqual('Schedule updated successfully');
        });

        it('should throw ConflictException if trying to update date/shift/employee with existing appointments', async () => {
             const id = 'sched-id';
             const updateDto = { workDate: '2024-05-20' };
             const schedule = { _id: id, clinicId: 'clinic-id', rooms: [], workDate: new Date() };

             mockScheduleRepository.findOne.mockResolvedValue(schedule);
             mockQueryBuilder.getRawMany.mockResolvedValue([{ _id: 'app-id' }]); // Has existing appointments

             await expect(service.update(id, updateDto)).rejects.toThrow(ConflictException);
        });

        it('should throw ConflictException if updated room is already occupied', async () => {
            const id = 'sched-id';
            const updateDto = { roomId: 'occupied-room-id' };
            const schedule = { _id: id, clinicId: 'clinic-id', rooms: [], workDate: new Date() };

            mockScheduleRepository.findOne.mockResolvedValue(schedule);
            mockRoomRepository.findOne.mockResolvedValue({ _id: 'occupied-room-id' });
            mockQueryBuilder.getRawMany.mockResolvedValue([]); // No appointments
            mockScheduleRepository.findRoomConflict.mockResolvedValue({ _id: 'other-id' }); // Room occupied

            await expect(service.update(id, updateDto)).rejects.toThrow(ConflictException);
        });
    });


    describe('copySchedule', () => {
        it('should copy schedules successfully skipping conflicts', async () => {
            const user = { _id: 'manager-id', role: AccountRole.CLINIC_MANAGER, parentId: 'clinic-id' };
            const copyDto = {
                fromDates: ['2024-05-20', '2024-05-21'],
                targetDate: '2024-05-27'
            };

            // Source schedules
            const sourceSchedules = [
                { employeeId: 'emp-1', clinicShiftId: 'shift-1', clinicId: 'clinic-id' }
            ];

            mockScheduleRepository.findSchedules.mockResolvedValue([]); // Default
            // Mock find for source dates
            mockScheduleRepository.find = jest.fn()
                .mockResolvedValueOnce(sourceSchedules) // Date 1 found
                .mockResolvedValueOnce([]); // Date 2 empty

            // Mock Conflict check
            mockScheduleRepository.findConflict.mockResolvedValue(null); // No conflict

            mockQueryRunner.manager.create.mockReturnValue({ _id: 'new-sched-id' });
            mockQueryRunner.manager.save.mockResolvedValue({});

            const result = await service.copySchedule(user, copyDto);

            expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
            expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
            expect(result.copied).toBe(1);
            expect(result.skipped).toBe(0);
        });

        it('should skip schedules with room conflicts in target date', async () => {
            const user = { _id: 'manager-id', role: AccountRole.CLINIC_MANAGER, parentId: 'clinic-id' };
            const copyDto = {
                fromDates: ['2024-05-20'],
                targetDate: '2024-05-27'
            };

            const sourceSchedules = [
                { employeeId: 'emp-1', clinicShiftId: 'shift-1', clinicId: 'clinic-id', rooms: [{ _id: 'room-1' }] }
            ];

            mockScheduleRepository.find.mockResolvedValueOnce(sourceSchedules);
            mockScheduleRepository.findConflict.mockResolvedValue(null); // No doctor conflict
            mockScheduleRepository.findRoomConflict.mockResolvedValue({ _id: 'other-sched' }); // Room conflict!

            const result = await service.copySchedule(user, copyDto);

            expect(result.copied).toBe(0);
            expect(result.skipped).toBe(1);
        });
    });



    describe('getEmployees', () => {
        it('should return list of employees for manager with role-specific names', async () => {
            const user = { _id: 'manager-id', role: AccountRole.CLINIC_MANAGER, parentId: 'clinic-id' };
            const employees = [
                { _id: 'emp-1', username: 'doc1', role: AccountRole.DOCTOR },
                { _id: 'emp-2', username: 'staff1', role: AccountRole.CLINIC_STAFF }
            ];
            const doctorInfos = [
                { accountId: 'emp-1', fullName: 'Dr. Who', profilePicture: 'url' }
            ];
            const staffInfos = [
                { accountId: 'emp-2', fullName: 'Staff Mary', profilePicture: 'url' }
            ];

            // Manager lookup
            mockAccountRepository.findOne.mockResolvedValue(user);
            // Employee lookup
            mockAccountRepository.find.mockResolvedValue(employees);
            mockDoctorInfoRepository.find.mockResolvedValue(doctorInfos as any);
            mockGeneralAccountRepository.find.mockResolvedValue([]);
            mockClinicStaffRepository.find.mockResolvedValue(staffInfos as any);

            const result = await service.getEmployees(user);

            expect(result).toHaveLength(2);
            expect(result.find(e => e.id === 'emp-1').name).toBe('Dr. Who'); // From DoctorInfo
            expect(result.find(e => e.id === 'emp-2').name).toBe('Staff Mary'); // From ClinicStaffInfo
        });
    });

    describe('Validation', () => {
        it('should throw BadRequestException if clinicId is missing', async () => {
            await expect(service.create('', {} as any)).rejects.toThrow(BadRequestException);
        });

        it('should throw NotFoundException if employee not found during create', async () => {
            const clinicId = 'clinic-id';
            const createDto: CreateScheduleDto = {
                employeeId: 'invalid-emp',
                items: []
            };
            mockAccountRepository.findOne.mockResolvedValue(null);

            await expect(service.create(clinicId, createDto)).rejects.toThrow(NotFoundException);
        });

        it('should throw NotFoundException if clinic not found', async () => {
            const clinicId = 'clinic-id';
            mockAccountRepository.findOne
                .mockResolvedValueOnce({ _id: 'emp-id' }) // Employee found
                .mockResolvedValueOnce(null); // Clinic not found

            await expect(service.create(clinicId, { employeeId: 'emp-id', items: [] })).rejects.toThrow(NotFoundException);
        });
    });

    describe('Helpers', () => {
        it('getShifts should return shifts', async () => {
            const user = { _id: 'manager-id', role: AccountRole.CLINIC_MANAGER };
            mockShiftRepository.find.mockResolvedValue([{ _id: 's1', shift: 'MORNING' }]);

            const res = await service.getShifts(user);
            expect(res).toHaveLength(1);
        });

        it('getRooms should return rooms', async () => {
            const user = { _id: 'manager-id', role: AccountRole.CLINIC_MANAGER };
            mockRoomRepository.find.mockResolvedValue([{ _id: 'r1', roomName: 'R1' }]);

            const res = await service.getRooms(user);
            expect(res).toHaveLength(1);
        });
    });
});
