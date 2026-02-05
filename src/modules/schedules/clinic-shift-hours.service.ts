import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicShiftHour } from './entities/clinic-shift-hour.entity';
import { ClinicShift } from './entities/clinic-shift.entity';
import { CreateClinicShiftHourDto } from './dto/create-clinic-shift-hour.dto';
import { UpdateClinicShiftHourDto } from './dto/update-clinic-shift-hour.dto';
import { ConfigureShiftDto } from './dto/configure-shift.dto';
import { Account } from '../accounts/entities/accounts.entity';
import { AccountRole } from '../accounts/enums';

@Injectable()
export class ClinicShiftHoursService {
    constructor(
        @InjectRepository(ClinicShiftHour)
        private readonly shiftHourRepository: Repository<ClinicShiftHour>,
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
            return user.parentId || user._id;
        }
        // Admin or other roles? For now assume Manager mainly.
        // If strict multi-tenancy for admin, logic needed here.
        if (user.role === AccountRole.CLINIC_STAFF || user.role === AccountRole.DOCTOR) {
            // usually only manager configs hours, but if staff allowed:
            if (user.parentId) {
                const manager = await this.accountRepository.findOne({ where: { _id: user.parentId } });
                return manager ? manager.parentId || manager._id : null;
            }
        }
        return user._id; // Fallback
    }

    async create(user: any, createDto: CreateClinicShiftHourDto) {
        const clinicId = await this.resolveClinicId(user);
        if (!clinicId) throw new ForbiddenException('Cannot resolve clinic ID');

        // Validate Shift belongs to Clinic
        const shift = await this.shiftRepository.findOne({
            where: { _id: createDto.shiftId, clinicId }
        });

        if (!shift) {
            throw new NotFoundException('Clinic Shift not found or access denied');
        }

        // Parse hours
        const startParts = createDto.startHour.split(':').map(Number);
        const endParts = createDto.endHour.split(':').map(Number);
        const startVal = startParts[0] * 60 + startParts[1];
        const endVal = endParts[0] * 60 + endParts[1];

        if (startVal >= endVal) {
            throw new BadRequestException('Start hour must be before end hour');
        }

        const newHour = this.shiftHourRepository.create({
            shiftId: createDto.shiftId,
            startHour: createDto.startHour,
            endHour: createDto.endHour,
            limit: createDto.limit,
        });

        return this.shiftHourRepository.save(newHour);
    }

    async findAll(user: any, shiftId: string) {
        const clinicId = await this.resolveClinicId(user);

        // Validate shift access
        const shift = await this.shiftRepository.findOne({
            where: { _id: shiftId, clinicId }
        });
        if (!shift) return [];

        return this.shiftHourRepository.find({
            where: { shiftId },
            order: { startHour: 'ASC' }
        });
    }

    async update(user: any, id: string, updateDto: UpdateClinicShiftHourDto) {
        const clinicId = await this.resolveClinicId(user);

        const hour = await this.shiftHourRepository.findOne({
            where: { _id: id },
            relations: ['shift']
        });

        if (!hour) throw new NotFoundException('Shift Hour not found');

        // Check ownership
        if (hour.shift.clinicId !== clinicId) {
            throw new ForbiddenException('Access denied');
        }

        if (updateDto.startHour && updateDto.endHour) {
            // Validate time...
        }

        Object.assign(hour, updateDto);
        return this.shiftHourRepository.save(hour);
    }

    async remove(user: any, id: string) {
        const clinicId = await this.resolveClinicId(user);

        const hour = await this.shiftHourRepository.findOne({
            where: { _id: id },
            relations: ['shift']
        });

        if (!hour) throw new NotFoundException('Shift Hour not found');

        if (hour.shift.clinicId !== clinicId) {
            throw new ForbiddenException('Access denied');
        }

        await this.shiftHourRepository.softDelete(id);
        return { message: 'Deleted successfully' };
    }

    /**
     * Apply Configuration (Generate Slots)
     */
    async applyConfiguration(user: any, configDto: ConfigureShiftDto) {
        const clinicId = await this.resolveClinicId(user);
        if (!clinicId) throw new ForbiddenException('Cannot resolve clinic ID');

        // Validate Shift
        const shift = await this.shiftRepository.findOne({
            where: { _id: configDto.shiftId, clinicId }
        });
        if (!shift) throw new NotFoundException('Clinic Shift not found or access denied');

        // Validate Times
        const startParts = configDto.startHour.split(':').map(Number);
        const endParts = configDto.endHour.split(':').map(Number);
        const startTotalMins = startParts[0] * 60 + startParts[1];
        const endTotalMins = endParts[0] * 60 + endParts[1];

        if (startTotalMins >= endTotalMins) {
            throw new BadRequestException('Start hour must be before end hour');
        }

        const stepMins = configDto.step * 60; // Convert step (hours) to minutes
        if (stepMins <= 0) throw new BadRequestException('Step must be positive');

        // Soft Delete existing slots for this shift
        await this.shiftHourRepository.softDelete({ shiftId: configDto.shiftId });

        // Generate new slots
        const newSlots = [];
        let currentMins = startTotalMins;

        while (currentMins + stepMins <= endTotalMins) {
            const slotStartMins = currentMins;
            const slotEndMins = currentMins + stepMins;

            const startH = Math.floor(slotStartMins / 60).toString().padStart(2, '0');
            const startM = (slotStartMins % 60).toString().padStart(2, '0');
            const endH = Math.floor(slotEndMins / 60).toString().padStart(2, '0');
            const endM = (slotEndMins % 60).toString().padStart(2, '0');

            newSlots.push(this.shiftHourRepository.create({
                shiftId: configDto.shiftId,
                startHour: `${startH}:${startM}`,
                endHour: `${endH}:${endM}`,
                limit: configDto.limit
            }));

            currentMins += stepMins;
        }

        if (newSlots.length > 0) {
            await this.shiftHourRepository.save(newSlots);
        }

        return {
            message: 'Configuration applied successfully',
            totalSlots: newSlots.length
        };
    }

    /**
     * Get Configuration History
     */
    async getHistory(user: any, shiftId: string) {
        const clinicId = await this.resolveClinicId(user);

        // Validate Shift
        const shift = await this.shiftRepository.findOne({
            where: { _id: shiftId, clinicId }
        });
        if (!shift) throw new NotFoundException('Clinic Shift not found');

        // Fetch all slots including deleted ones
        const allSlots = await this.shiftHourRepository.find({
            where: { shiftId },
            withDeleted: true,
            order: { createdAt: 'DESC' }
        });

        if (!allSlots.length) return [];

        // Group by CreatedAt (approximate to seconds to handle batch inserts)
        const groups = new Map<string, ClinicShiftHour[]>();

        allSlots.forEach(slot => {
            const key = slot.createdAt.toISOString();
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(slot);
        });

        const history = [];

        groups.forEach((slots, key) => {
            if (slots.length === 0) return;

            // Sort slots in this group by start time
            slots.sort((a, b) => a.startHour.localeCompare(b.startHour));

            const firstSlot = slots[0];
            const lastSlot = slots[slots.length - 1];

            // Calculate Step
            const [startH, startM] = firstSlot.startHour.split(':').map(Number);
            const [endH, endM] = firstSlot.endHour.split(':').map(Number);
            const startMins = startH * 60 + startM;
            const endMins = endH * 60 + endM;
            const stepMins = endMins - startMins;
            const stepHours = stepMins / 60;

            history.push({
                configId: key,
                createdAt: firstSlot.createdAt,
                startHour: firstSlot.startHour,
                endHour: lastSlot.endHour,
                step: parseFloat(stepHours.toFixed(2)), // Return Step in Hours
                limit: firstSlot.limit
            });
        });

        // Sort by createdAt descending
        return history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
}
