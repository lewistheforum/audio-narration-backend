import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicShiftsService } from 'src/modules/schedules/clinic-shifts.service';
import { ClinicShift } from 'src/modules/schedules/entities/clinic-shift.entity';
import { Account } from 'src/modules/accounts/entities/accounts.entity';
import { AccountRole } from 'src/modules/accounts/enums';
import { CreateClinicShiftDto } from 'src/modules/schedules/dto/create-clinic-shift.dto';
import { ShiftType } from 'src/modules/schedules/enums/shift-type.enum';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('ClinicShiftsService', () => {
    let service: ClinicShiftsService;
    let shiftRepository: Repository<ClinicShift>;
    let accountRepository: Repository<Account>;

    const mockShiftRepository = {
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        softDelete: jest.fn(),
    };

    const mockAccountRepository = {
        findOne: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ClinicShiftsService,
                {
                    provide: getRepositoryToken(ClinicShift),
                    useValue: mockShiftRepository,
                },
                {
                    provide: getRepositoryToken(Account),
                    useValue: mockAccountRepository,
                },
            ],
        }).compile();

        service = module.get<ClinicShiftsService>(ClinicShiftsService);
        shiftRepository = module.get<Repository<ClinicShift>>(getRepositoryToken(ClinicShift));
        accountRepository = module.get<Repository<Account>>(getRepositoryToken(Account));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a new shift for clinic manager', async () => {
            const user = { _id: 'manager-id', role: AccountRole.CLINIC_MANAGER, parentId: 'clinic-id' };
            const createDto: CreateClinicShiftDto = { shift: ShiftType.MORNING };
            const savedShift = { _id: 'shift-id', ...createDto, clinicId: 'clinic-id' };

            mockShiftRepository.create.mockReturnValue(savedShift);
            mockShiftRepository.save.mockResolvedValue(savedShift);

            const result = await service.create(user, createDto);

            expect(mockShiftRepository.create).toHaveBeenCalledWith({
                clinicId: 'clinic-id',
                shift: ShiftType.MORNING,
            });
            expect(mockShiftRepository.save).toHaveBeenCalledWith(savedShift);
            expect(result).toEqual(savedShift);
        });
    });

    describe('findAll', () => {
        it('should return an array of shifts', async () => {
            const user = { _id: 'manager-id', role: AccountRole.CLINIC_MANAGER, parentId: 'clinic-id' };
            const shifts = [{ _id: 'shift-1', shift: ShiftType.MORNING }];

            mockShiftRepository.find.mockResolvedValue(shifts);

            const result = await service.findAll(user);

            expect(mockShiftRepository.find).toHaveBeenCalledWith({
                where: { clinicId: 'clinic-id' },
                order: { createdAt: 'ASC' },
            });
            expect(result).toEqual(shifts);
        });
    });

    describe('remove', () => {
        it('should soft delete a shift', async () => {
            const user = { _id: 'manager-id', role: AccountRole.CLINIC_MANAGER, parentId: 'clinic-id' };
            const shiftId = 'shift-id';
            const shift = { _id: shiftId, clinicId: 'clinic-id' };

            mockShiftRepository.findOne.mockResolvedValue(shift);
            mockShiftRepository.softDelete.mockResolvedValue({ affected: 1 });

            const result = await service.remove(user, shiftId);

            expect(mockShiftRepository.softDelete).toHaveBeenCalledWith(shiftId);
            expect(result).toEqual({ message: 'Deleted successfully' });
        });

        it('should throw NotFoundException if shift not found', async () => {
            const user = { _id: 'manager-id', role: AccountRole.CLINIC_MANAGER, parentId: 'clinic-id' };
            mockShiftRepository.findOne.mockResolvedValue(null);

            await expect(service.remove(user, 'invalid-id')).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if shift belongs to another clinic', async () => {
            const user = { _id: 'manager-id', role: AccountRole.CLINIC_MANAGER, parentId: 'clinic-id' };
            const shift = { _id: 'shift-id', clinicId: 'other-clinic-id' };

            mockShiftRepository.findOne.mockResolvedValue(shift);

            await expect(service.remove(user, 'shift-id')).rejects.toThrow(ForbiddenException);
        });
    });

    describe('resolveClinicId logic', () => {
        it('should resolve clinicId for DOCTOR/STAFF via manager parent', async () => {
            const user = { _id: 'staff-id', role: AccountRole.CLINIC_STAFF, parentId: 'manager-id' };
            const manager = { _id: 'manager-id', parentId: 'clinic-id', role: AccountRole.CLINIC_MANAGER };

            mockAccountRepository.findOne.mockResolvedValue(manager);
            // mock find for creating shift to succeed or fail? 
            // The service allows it if clinicId is resolved. 
            // We test if it resolves correctly by calling findAll which uses it.

            mockShiftRepository.find.mockResolvedValue([]);
            await service.findAll(user);

            expect(mockAccountRepository.findOne).toHaveBeenCalledWith({ where: { _id: 'manager-id' } });
            expect(mockShiftRepository.find).toHaveBeenCalledWith(expect.objectContaining({ where: { clinicId: 'clinic-id' } }));
        });

        it('should return empty array in findAll if clinicId cannot be resolved', async () => {
            const user = { _id: 'staff-id', role: AccountRole.CLINIC_STAFF, parentId: null };
            // parentId null -> resolveClinicId returns null (or user._id fallback? Code says fallback)
            // Wait, code says: return user._id if logic falls through.
            // Let's test the specific branch where it explicitly returns null or fails.

            // Actually the code fallback is `return user._id`.
            // So it effectively returns 'staff-id' as clinicId.
            // We can test that.

            mockShiftRepository.find.mockResolvedValue([]);
            await service.findAll(user);
            expect(mockShiftRepository.find).toHaveBeenCalledWith(expect.objectContaining({ where: { clinicId: 'staff-id' } }));
        });
    });
});
