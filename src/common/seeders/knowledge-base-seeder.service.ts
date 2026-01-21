import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KnowledgeBaseRepository } from '../../modules/ai-rag-chat-bot/repositories/knowledge-base.repository';
import { DoctorInformation } from '../../modules/accounts/entities/doctor_information.entity';
import { ClinicAdminInformation } from '../../modules/accounts/entities/clinic-admin-information.entity';
import { Feedback } from '../../modules/reports/entities/feedback.entity';
import { ClinicServiceConfig } from '../../modules/service-configs/entities/clinic-service-config.entity';
import { EmployeeSchedule } from '../../modules/schedules/entities/employee-schedule.entity';
import { ClinicShift } from '../../modules/schedules/entities/clinic-shift.entity';
import { ClinicShiftHour } from '../../modules/schedules/entities/clinic-shift-hour.entity';
import { ClinicRoom } from '../../modules/accounts/entities/clinic_room.entity';

@Injectable()
export class KnowledgeBaseSeederService {
  private readonly logger = new Logger(KnowledgeBaseSeederService.name);

  constructor(
    private readonly knowledgeBaseRepository: KnowledgeBaseRepository,
    @InjectRepository(DoctorInformation)
    private readonly doctorInfoRepo: Repository<DoctorInformation>,
    @InjectRepository(ClinicAdminInformation)
    private readonly clinicInfoRepo: Repository<ClinicAdminInformation>,
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    @InjectRepository(ClinicServiceConfig)
    private readonly serviceConfigRepo: Repository<ClinicServiceConfig>,
    @InjectRepository(EmployeeSchedule)
    private readonly employeeScheduleRepo: Repository<EmployeeSchedule>,
    @InjectRepository(ClinicShift)
    private readonly clinicShiftRepo: Repository<ClinicShift>,
    @InjectRepository(ClinicShiftHour)
    private readonly clinicShiftHourRepo: Repository<ClinicShiftHour>,
    @InjectRepository(ClinicRoom)
    private readonly clinicRoomRepo: Repository<ClinicRoom>,
  ) {}

  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed Knowledge Base...');

      // 1. Seed Doctor Information
      await this.seedDoctorInfo();

      // 2. Seed Clinic Information
      await this.seedClinicInfo();

      // 3. Seed Services
      await this.seedServices();

      // 4. Seed Schedules
      await this.seedSchedules();

      // 5. Seed Rooms
      await this.seedRooms();

      this.logger.log('✅ Knowledge Base seeding completed.');
    } catch (error) {
      this.logger.error('Failed to seed Knowledge Base', error.stack);
    }
  }

  private async seedDoctorInfo() {
    const doctors = await this.doctorInfoRepo.find({ relations: ['account'] });
    for (const doctor of doctors) {
      const content =
        `Doctor Profile: ${doctor.fullName}. Gender: ${doctor.gender}. ` +
        `Degree: ${doctor.academicDegree}. Experience: ${doctor.experience}. ` +
        `Position: ${doctor.position}. Specialization: ${JSON.stringify(doctor.workProcess2 || {})}.`;

      await this.knowledgeBaseRepository.createKnowledge({
        content: content,
        metadata: {
          type: 'doctor',
          id: doctor._id,
          accountId: doctor.accountId,
        },
      });
    }
    this.logger.log(`Seeded ${doctors.length} doctor profiles.`);
  }

  private async seedClinicInfo() {
    const clinics = await this.clinicInfoRepo.find({ relations: ['account'] });
    for (const clinic of clinics) {
      const content =
        `Clinic Profile: ${clinic.clinicName}. Phone: ${clinic.clinicPhone}. ` +
        `Description: ${clinic.description}. Pros: ${JSON.stringify(clinic.pros)}. ` +
        `Paraclinical: ${JSON.stringify(clinic.paraclinical)}. Verified: ${clinic.isVerify}.`;

      await this.knowledgeBaseRepository.createKnowledge({
        content: content,
        metadata: {
          type: 'clinic',
          id: clinic._id,
          accountId: clinic.accountId,
        },
      });
    }
    this.logger.log(`Seeded ${clinics.length} clinic profiles.`);
  }

  private async seedServices() {
    const services = await this.serviceConfigRepo.find({
      relations: ['service', 'clinic'],
    });
    for (const config of services) {
      const content =
        `Service at ${config.clinic?.username}: ${config.service?.serviceName}. ` +
        `Price: ${config.price}. Duration: ${config.durationMin} mins. ` +
        `Description: ${config.service?.description}. Note: ${config.noteForPatient}.`;

      await this.knowledgeBaseRepository.createKnowledge({
        content: content,
        metadata: {
          type: 'service',
          id: config._id,
          clinicId: config.clinicId,
        },
      });
    }
    this.logger.log(`Seeded ${services.length} services.`);
  }

  private async seedSchedules() {
    const shifts = await this.clinicShiftRepo.find({ relations: ['clinic'] });
    for (const shift of shifts) {
      const hours = await this.clinicShiftHourRepo.find({
        where: { shiftId: shift._id },
      });
      const hoursText = hours
        .map((h) => `${h.startHour}-${h.endHour}`)
        .join(', ');

      const content = `Shift at ${shift.clinic?.username}: ${shift.shift}. Hours: ${hoursText}.`;

      await this.knowledgeBaseRepository.createKnowledge({
        content: content,
        metadata: { type: 'shift', id: shift._id, clinicId: shift.clinicId },
      });
    }
    this.logger.log(`Seeded ${shifts.length} shifts.`);
  }

  private async seedRooms() {
    const rooms = await this.clinicRoomRepo.find({ relations: ['clinic'] });
    for (const room of rooms) {
      const content = `Room at ${room.clinic?.username}: ${room.roomName}.`;
      await this.knowledgeBaseRepository.createKnowledge({
        content: content,
        metadata: { type: 'room', id: room._id, clinicId: room.clinicId },
      });
    }
    this.logger.log(`Seeded ${rooms.length} rooms.`);
  }
}
