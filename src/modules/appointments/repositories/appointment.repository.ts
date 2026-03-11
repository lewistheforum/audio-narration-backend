import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, FindOneOptions } from 'typeorm';
import { Appointment } from '../entities';
import { AppointmentStatus } from '../enums';

/**
 * Appointment Repository
 *
 * Handles all direct database operations for the Appointment entity
 */
@Injectable()
export class AppointmentRepository {
  constructor(
    @InjectRepository(Appointment)
    private readonly repository: Repository<Appointment>,
  ) { }

  /**
   * Find a single appointment with options
   *
   * @param options - Find options
   * @returns Found appointment or null
   */
  async findOne(options: FindOneOptions<Appointment>): Promise<Appointment | null> {
    return this.repository.findOne(options);
  }

  /**
   * Create a query builder for the Appointment entity
   */
  createQueryBuilder(alias?: string) {
    return this.repository.createQueryBuilder(alias);
  }

  /**
   * Find appointments by clinic ID with filters and pagination
   *
   * @param clinicId - Clinic UUID
   * @param filters - Optional filters (status, date)
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10)
   * @returns Paginated appointments with relations
   */
  async findByClinicWithPagination(
    clinicId: string,
    filters?: {
      status?: AppointmentStatus;
      appointmentDate?: string;
    },
    page: number = 1,
    limit: number = 10,
  ): Promise<[Appointment[], number]> {
    const queryBuilder = this.repository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.generalAccount', 'patientGeneral')
      .leftJoinAndSelect('patient.addresses', 'patientAddresses')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .leftJoinAndSelect('clinic.clinicManagerInformation', 'clinicInfo')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.doctorInformation', 'doctorInfo')
      .where('appointment.clinicId = :clinicId', { clinicId })
      .andWhere('appointment.deletedAt IS NULL')
      .andWhere('appointment.extraHour IS NULL');

    // Apply status filter if provided
    if (filters?.status) {
      queryBuilder.andWhere('appointment.status = :status', {
        status: filters.status,
      });
    }

    // Apply date filter if provided
    if (filters?.appointmentDate) {
      queryBuilder.andWhere('appointment.appointmentDate = :appointmentDate', {
        appointmentDate: filters.appointmentDate,
      });
    }

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Order by appointment date and hour (newest first)
    queryBuilder
      .orderBy('appointment.appointmentDate', 'DESC')
      .addOrderBy('appointment.appointmentHour', 'DESC');

    return queryBuilder.getManyAndCount();
  }

  /**
   * Find appointments with extra_hour by clinic ID with filters and pagination
   *
   * @param clinicId - Clinic UUID
   * @param filters - Optional filters (status, date)
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 10)
   * @returns Paginated appointments with extra_hour and relations
   */
  async findByClinicWithExtraHourPagination(
    clinicId: string,
    filters?: {
      status?: AppointmentStatus;
      appointmentDate?: string;
    },
    page: number = 1,
    limit: number = 10,
  ): Promise<[Appointment[], number]> {
    const queryBuilder = this.repository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.generalAccount', 'patientGeneral')
      .leftJoinAndSelect('patient.addresses', 'patientAddresses')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .leftJoinAndSelect('clinic.clinicManagerInformation', 'clinicInfo')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.doctorInformation', 'doctorInfo')
      .where('appointment.clinicId = :clinicId', { clinicId })
      .andWhere('appointment.deletedAt IS NULL')
      .andWhere('appointment.extraHour IS NOT NULL');

    // Apply status filter if provided
    if (filters?.status) {
      queryBuilder.andWhere('appointment.status = :status', {
        status: filters.status,
      });
    }

    // Apply date filter if provided
    if (filters?.appointmentDate) {
      queryBuilder.andWhere('appointment.appointmentDate = :appointmentDate', {
        appointmentDate: filters.appointmentDate,
      });
    }

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Order by appointment date and hour (newest first)
    queryBuilder
      .orderBy('appointment.appointmentDate', 'DESC')
      .addOrderBy('appointment.appointmentHour', 'DESC');

    return queryBuilder.getManyAndCount();
  }

  /**
   * Find single appointment by ID with relations
   *
   * @param id - Appointment UUID
   * @returns Appointment with relations or null
   */
  async findByIdWithRelations(id: string): Promise<Appointment | null> {
    return this.repository.findOne({
      where: { _id: id },
      relations: ['patient', 'clinic', 'doctor'],
    });
  }

  /**
   * Find appointment by ID with complete details
   *
   * Includes all relations needed for detailed view:
   * - Patient with profile (GeneralAccount)
   * - Doctor with profile (DoctorInformation)
   * - Clinic
   * - Shift hour and shift information
   *
   * @param id - Appointment UUID
   * @returns Appointment with all details or null
   */
  async findByIdWithCompleteDetails(id: string): Promise<any | null> {
    return this.repository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoin(
        'general_accounts',
        'patientProfile',
        'patientProfile.account_id = patient._id',
      )
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoin(
        'doctor_information',
        'doctorProfile',
        'doctorProfile.account_id = doctor._id',
      )
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .leftJoinAndSelect('appointment.clinicShiftHour', 'shiftHour')
      .leftJoinAndSelect('shiftHour.shift', 'shift')
      .addSelect([
        'patientProfile._id',
        'patientProfile.full_name',
        'patientProfile.gender',
        'patientProfile.dob',
        'patientProfile.profile_picture',
        'doctorProfile._id',
        'doctorProfile.full_name',
        'doctorProfile.gender',
        'doctorProfile.dob',
        'doctorProfile.profile_picture',
        'doctorProfile.academic_degree',
        'doctorProfile.experience',
        'doctorProfile.position',
      ])
      .where('appointment._id = :id', { id })
      .andWhere('appointment.deletedAt IS NULL')
      .getOne();
  }

  /**
   * Count appointments by clinic ID
   *
   * @param clinicId - Clinic UUID
   * @returns Total count of appointments
   */
  async countByClinic(clinicId: string): Promise<number> {
    return this.repository.count({
      where: { clinicId },
    });
  }

  /**
   * Find appointments with specific criteria
   *
   * @param where - Find conditions
   * @returns Array of matching appointments
   */
  async find(where: FindOptionsWhere<Appointment>): Promise<Appointment[]> {
    return this.repository.find({ where });
  }

  /**
   * Create a new appointment instance
   *
   * @param data - Appointment data
   * @returns New appointment instance (not saved)
   */
  create(data: Partial<Appointment>): Appointment {
    return this.repository.create(data);
  }

  /**
   * Save appointment to database
   *
   * @param appointment - Appointment instance to save
   * @returns Saved appointment
   */
  async save(appointment: Appointment): Promise<Appointment> {
    return this.repository.save(appointment);
  }
}
