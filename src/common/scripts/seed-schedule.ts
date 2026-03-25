import * as dotenv from 'dotenv';
dotenv.config();

import { AppDataSource } from '../../config/typeorm.config';
import { ClinicShift } from '../../modules/schedules/entities/clinic-shift.entity';
import { ClinicRoom } from '../../modules/schedules/entities/clinic_room.entity';
import { EmployeeSchedule } from '../../modules/schedules/entities/employee-schedule.entity';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { ShiftType, WeekDay } from '../../modules/schedules/enums';
import { getCurrentVietnamTime, addToDate } from '../utils/date.util';

const clinicId = '0011ea95-f343-43a8-ad13-c4c5128073e5';
const employeeIds = [
    '0173934f-6ddc-485d-a2ef-15d3e06c73e7',
    '01e98ebf-84f8-49f3-8553-a1ad5024ac82',
    '02a96a00-c026-4906-a35c-8c1777e9eaf8',
    '03f26f68-dc90-4e84-9571-16cfd242f7b9',
    '04cf76df-2cd9-4e15-b309-5f2239e9a4a1',
    '0524704d-2775-48a9-86f3-cb5b96776007',
];

// npx ts-node -r tsconfig-paths/register src/common/scripts/seed-schedule.ts
async function seedSchedule() {
    try {
        console.log('Connecting to database...');
        await AppDataSource.initialize();
        console.log('Database connected.');

        // 1. Seed Clinic Shifts
        console.log('Seeding Clinic Shifts...');
        const shiftsData = [
            { shift: ShiftType.MORNING },
            { shift: ShiftType.AFTERNOON }
        ];
        const insertedShifts = [];

        for (const s of shiftsData) {
            let shift = await AppDataSource.getRepository(ClinicShift).findOne({
                where: { clinicId, shift: s.shift },
            });

            if (!shift) {
                shift = AppDataSource.getRepository(ClinicShift).create({
                    clinicId,
                    shift: s.shift,
                });
                await AppDataSource.getRepository(ClinicShift).save(shift);
                console.log(`Created shift: ${s.shift}`);
            }
            insertedShifts.push(shift);
        }

        // 2. Seed Clinic Rooms
        console.log('Seeding Clinic Rooms...');
        const roomsData = ['Phòng 101', 'Phòng 102'];
        const insertedRooms = [];

        for (const roomName of roomsData) {
            let room = await AppDataSource.getRepository(ClinicRoom).findOne({
                where: { clinicId, roomName },
            });

            if (!room) {
                room = AppDataSource.getRepository(ClinicRoom).create({
                    clinicId,
                    roomName,
                });
                await AppDataSource.getRepository(ClinicRoom).save(room);
                console.log(`Created room: ${roomName}`);
            }
            insertedRooms.push(room);
        }

        // 3. Seed Employee Schedules
        console.log('Seeding Employee Schedules...');
        const today = getCurrentVietnamTime();
        const next7Days = Array.from({ length: 7 }, (_, i) => {
            const d = addToDate(today, i + 1, 'day'); // Start from tomorrow
            return d;
        });

        const weekDayMap = [
            WeekDay.SUNDAY,
            WeekDay.MONDAY,
            WeekDay.TUESDAY,
            WeekDay.WEDNESDAY,
            WeekDay.THURSDAY,
            WeekDay.FRIDAY,
            WeekDay.SATURDAY,
        ];

        for (const date of next7Days) {
            const weekDay = weekDayMap[date.getDay()];
            console.log(`Processing date: ${date.toISOString().split('T')[0]} (${weekDay})`);

            // Shuffle doctors to assign random shifts
            const shuffledEmployees = [...employeeIds].sort(() => 0.5 - Math.random());

            for (let i = 0; i < shuffledEmployees.length; i++) {
                const employeeId = shuffledEmployees[i];

                // Assign a random shift and room
                const randomShift = insertedShifts[Math.floor(Math.random() * insertedShifts.length)];
                const randomRoom = insertedRooms[Math.floor(Math.random() * insertedRooms.length)];

                // Check conflict
                const existing = await AppDataSource.getRepository(EmployeeSchedule).findOne({
                    where: {
                        employeeId,
                        workDate: date,
                        clinicShiftId: randomShift._id,
                    },
                });

                if (!existing) {
                    const schedule = AppDataSource.getRepository(EmployeeSchedule).create({
                        clinicId,
                        employeeId,
                        clinicShiftId: randomShift._id,
                        workDate: date,
                        weekDay: weekDay,
                        rooms: [randomRoom],
                    });

                    await AppDataSource.getRepository(EmployeeSchedule).save(schedule);
                    console.log(`  -> Assigned ${employeeId} to ${randomShift.shift} in ${randomRoom.roomName}`);
                }
            }
        }

        console.log('Seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seedSchedule();
