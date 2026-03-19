import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicShiftHour } from './entities/clinic-shift-hour.entity';
import { ClinicShift } from './entities/clinic-shift.entity';

import {
  getCurrentVietnamTime,
  getVietnamTimestamp,
} from 'src/common/utils/date.util';
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
            return user._id; // Manager IS the clinic branch
        }
        if (user.role === AccountRole.CLINIC_STAFF || user.role === AccountRole.DOCTOR) {
            // Doctor/Staff's parentId = CLINIC_MANAGER._id (the branch they belong to)
            if (user.parentId) {
                return user.parentId;
            }
        }
        return user._id; // Fallback
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
    /**
     * Get Configuration History by Shift Type
     */
    async getHistory(user: any, shiftType: string) {
        const clinicId = await this.resolveClinicId(user);

        // Find ALL shifts of this type for the clinic
        const shifts = await this.shiftRepository.find({
            where: {
                clinicId,
                shift: shiftType as any // Cast to ShiftType or let existing string validation handle it? ideally validate
            },
            select: ['_id', 'shift'] // Select shift
        });

        if (!shifts.length) return [];

        const shiftIds = shifts.map(s => s._id);

        // Fetch all slots for THESE shifts including deleted ones
        // We can't use 'shiftId' in where clause directly if it's multiple. 
        // Need In operator.
        // Importing In from typeorm is needed. 
        // But wait, In is not imported. 
        // I will add the import or use a query builder if 'In' is missing. 
        // Let's check imports first or assume I can add it.
        // Actually, let's use a workaround or add the import in a separate block if needed.
        // Assuming In is exported from 'typeorm' which is commonly used.
        // I'll check imports at top of file. 

        // Wait, I can't check imports mid-edit easily. 
        // I'll assume I need to update imports too.

        // Let's assume I will update imports in another chunk or this one if top of file is visible.
        // Top of file imports: import { Repository } from 'typeorm';
        // I need to change that.

        // FETCHING DATA
        // Since I can't easily rely on 'In' without checking/adding import, I can loop or use query builder.
        // const allSlots = await this.shiftHourRepository.createQueryBuilder('hour')
        //    .where('hour.shiftId IN (:...ids)', { ids: shiftIds })
        //    .withDeleted()
        //    .orderBy('hour.createdAt', 'DESC')
        //    .getMany();

        const allSlots = await this.shiftHourRepository.createQueryBuilder('hour')
            .where('hour.shiftId IN (:...ids)', { ids: shiftIds })
            .withDeleted() // Important for history
            .orderBy('hour.createdAt', 'DESC')
            .getMany();

        if (!allSlots.length) return [];

        // Group by CreatedAt + ShiftId (To distinguish different configs)
        // Actually, config is per shift. 
        // If two shifts were configured at same second, they are distinct configs.
        // Key should probably include shiftId just to be safe, 
        // BUT user wants to see "Morning" history. 
        // If I group by createdAt only, and I configured Morning 1 and Morning 2 at exact same time, they merge?
        // Unlikely to be EXACT ms, but possible in batch.
        // Better to group by logic: A config is a set of slots with same createdAt AND same shiftId.

        const groups = new Map<string, ClinicShiftHour[]>();

        allSlots.forEach(slot => {
            // Key: timestamp_shiftId
            const key = `${slot.createdAt.toISOString()}_${slot.shiftId}`;
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
            const [endH, endM] = firstSlot.endHour.split(':').map(Number); // first slot step calculation

            // Wait, step is (slotEnd - slotStart). 
            // In the previous code: stepMins = endMins - startMins (of the first slot)
            // Correct.

            const startMins = startH * 60 + startM;
            const endMins = endH * 60 + endM;
            const stepMins = endMins - startMins;
            const stepHours = stepMins / 60;

            // Find matching shift to get name
            const matchingShift = shifts.find(s => s._id === firstSlot.shiftId);

            history.push({
                shiftId: firstSlot.shiftId, // Optional: let user know which shift this was
                shiftName: matchingShift ? matchingShift.shift : null,
                // configId: key, // maybe not needed for user
                createdAt: firstSlot.createdAt,
                startHour: firstSlot.startHour,
                endHour: lastSlot.endHour, // The very last slot's end time determines the Shift End Time
                step: parseFloat(stepHours.toFixed(2)),
                limit: firstSlot.limit
            });
        });

        // Sort by createdAt descending
        return history.sort((a, b) => getVietnamTimestamp(b.createdAt) - getVietnamTimestamp(a.createdAt));
    }
}
