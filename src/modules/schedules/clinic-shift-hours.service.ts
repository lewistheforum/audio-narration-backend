import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicShiftHour } from './entities/clinic-shift-hour.entity';
import { ClinicShift } from './entities/clinic-shift.entity';

import {
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
            return user._id;
        }
        if (user.role === AccountRole.CLINIC_STAFF || user.role === AccountRole.DOCTOR) {
            if (user.parentId) {
                return user.parentId;
            }
        }
        return user._id;
    }

    async findAll(user: any, shiftId: string) {
        const clinicId = await this.resolveClinicId(user);

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

        const shift = await this.shiftRepository.findOne({
            where: { _id: configDto.shiftId, clinicId }
        });
        if (!shift) throw new NotFoundException('Clinic Shift not found or access denied');

        const startParts = configDto.startHour.split(':').map(Number);
        const endParts = configDto.endHour.split(':').map(Number);
        const startTotalMins = startParts[0] * 60 + startParts[1];
        const endTotalMins = endParts[0] * 60 + endParts[1];

        if (startTotalMins >= endTotalMins) {
            throw new BadRequestException('Start hour must be before end hour');
        }

        const stepMins = configDto.step * 60;
        if (stepMins <= 0) throw new BadRequestException('Step must be positive');

        await this.shiftHourRepository.softDelete({ shiftId: configDto.shiftId });

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
     * Get Configuration History by Shift Type
     */
    async getHistory(user: any, shiftType: string) {
        const clinicId = await this.resolveClinicId(user);

        const shifts = await this.shiftRepository.find({
            where: {
                clinicId,
                shift: shiftType as any
            },
            select: ['_id', 'shift']
        });

        if (!shifts.length) return [];

        const shiftIds = shifts.map(s => s._id);

        const allSlots = await this.shiftHourRepository.createQueryBuilder('hour')
            .where('hour.shiftId IN (:...ids)', { ids: shiftIds })
            .withDeleted()
            .orderBy('hour.createdAt', 'DESC')
            .getMany();

        if (!allSlots.length) return [];

        const groups = new Map<string, ClinicShiftHour[]>();

        allSlots.forEach(slot => {
            const key = `${slot.createdAt.toISOString()}_${slot.shiftId}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(slot);
        });

        const history = [];

        groups.forEach((slots, key) => {
            if (slots.length === 0) return;

            slots.sort((a, b) => a.startHour.localeCompare(b.startHour));

            const firstSlot = slots[0];
            const lastSlot = slots[slots.length - 1];

            const [startH, startM] = firstSlot.startHour.split(':').map(Number);
            const [endH, endM] = firstSlot.endHour.split(':').map(Number);

            const startMins = startH * 60 + startM;
            const endMins = endH * 60 + endM;
            const stepMins = endMins - startMins;
            const stepHours = stepMins / 60;

            const matchingShift = shifts.find(s => s._id === firstSlot.shiftId);

            history.push({
                shiftId: firstSlot.shiftId,
                shiftName: matchingShift ? matchingShift.shift : null,
                createdAt: firstSlot.createdAt,
                startHour: firstSlot.startHour,
                endHour: lastSlot.endHour,
                step: parseFloat(stepHours.toFixed(2)),
                limit: firstSlot.limit
            });
        });

        return history.sort((a, b) => getVietnamTimestamp(b.createdAt) - getVietnamTimestamp(a.createdAt));
    }
}
