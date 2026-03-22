import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicShift } from './entities/clinic-shift.entity';
import { Account } from '../accounts/entities/accounts.entity';
import { AccountRole } from '../accounts/enums';
import { CreateClinicShiftDto } from './dto/create-clinic-shift.dto';

@Injectable()
export class ClinicShiftsService {
    constructor(
        @InjectRepository(ClinicShift)
        private readonly shiftRepository: Repository<ClinicShift>,
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>,
    ) { }

    /**
     * Resolve Clinic ID helper
     */
    private async resolveClinicId(user: any): Promise<string> {
        if (user.role === AccountRole.CLINIC_MANAGER) {
            return user._id;
        }
        if (user.role === AccountRole.CLINIC_STAFF || user.role === AccountRole.DOCTOR) {
            if (user.parentId) {
                return user.parentId;
            }
        }
        return user._id;
    }

    async create(user: any, createDto: CreateClinicShiftDto) {
        const clinicId = await this.resolveClinicId(user);
        if (!clinicId) throw new ForbiddenException('Cannot resolve clinic ID');

        const newShift = this.shiftRepository.create({
            clinicId,
            shift: createDto.shift
        });

        return this.shiftRepository.save(newShift);
    }

    async findAll(user: any) {
        const clinicId = await this.resolveClinicId(user);
        if (!clinicId) return [];

        return this.shiftRepository.find({
            where: { clinicId },
            order: { createdAt: 'ASC' }
        });
    }

    async remove(user: any, id: string) {
        const clinicId = await this.resolveClinicId(user);

        const shift = await this.shiftRepository.findOne({
            where: { _id: id }
        });

        if (!shift) throw new NotFoundException('Shift not found');

        if (shift.clinicId !== clinicId) {
            throw new ForbiddenException('Access denied');
        }

        await this.shiftRepository.softDelete(id);
        return { message: 'Deleted successfully' };
    }
}
