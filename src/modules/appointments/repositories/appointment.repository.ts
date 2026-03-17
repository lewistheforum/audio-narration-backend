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
      .leftJoinAndSelect('patient.address', 'patientAddress')
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
      .leftJoinAndSelect('patient.address', 'patientAddress')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .leftJoinAndSelect('clinic.clinicManagerInformation', 'clinicInfo')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.doctorInformation', 'doctorInfo')
      .leftJoinAndSelect('appointment.extraRoom', 'extraRoom')
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
      relations: ['patient', 'clinic', 'doctor', 'extraRoom'],
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
      .leftJoinAndSelect('patient.address', 'patientAddresses')
      .leftJoinAndSelect('patient.generalAccount', 'patientProfile')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.doctorInformation', 'doctorProfile')
      .leftJoinAndSelect('appointment.clinic', 'clinic')
      .leftJoinAndSelect('clinic.clinicAdminInformation', 'clinicAdminInfo')
      .leftJoinAndSelect('clinic.address', 'clinicAddress')
      .leftJoinAndSelect('appointment.clinicShiftHour', 'shiftHour')
      .leftJoinAndSelect('shiftHour.shift', 'shift')
      .leftJoinAndSelect('appointment.extraRoom', 'extraRoom')
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

  /**
   * Find appointments that need a reminder (Confirmed, not yet reminded, in next 24 hours)
   *
   * Uses raw SQL provided by the user with optimized time logic.
   */
  async findAppointmentsNeedingReminder(): Promise<any[]> {
    const rawQuery = `
      SELECT
          a._id AS appointment_id,
          a.patient_id,
          a.appointment_date,
          a.appointment_hour,
          a.status,
          COALESCE(ga.full_name, p.username) AS patient_name,
          p.phone    AS patient_phone,
          p.email    AS patient_email,
          COALESCE(cmi.clinic_branch_name, cai_chuan_br.clinic_name, cai_test_data.clinic_name) AS clinic_name,
          cmi.clinic_branch_name AS clinic_branch_name,
          cacc.phone AS manager_phone,
          COALESCE(cai_chuan_br.clinic_phone, cai_test_data.clinic_phone) AS clinic_admin_phone,
          COALESCE(ad_m.address, ad_a.address) AS address,
          COALESCE(ad_m.ward_name, ad_a.ward_name) AS ward_name,
          COALESCE(ad_m.district_name, ad_a.district_name) AS district_name,
          COALESCE(ad_m.province_name, ad_a.province_name) AS province_name,
          COALESCE(di.full_name, 'N/A') AS doctor_name,
          STRING_AGG(DISTINCT cs.service_name, ', ') AS service_names
      FROM appointments a
      JOIN accounts p ON p._id = a.patient_id
      LEFT JOIN general_accounts ga ON ga.account_id = p._id AND ga.deleted_at IS NULL
      LEFT JOIN accounts cacc ON cacc._id = a.clinic_id AND cacc.deleted_at IS NULL
      LEFT JOIN clinic_admin_information cai_chuan_br ON cai_chuan_br.account_id = cacc.parent_id AND cai_chuan_br.deleted_at IS NULL
      LEFT JOIN clinic_admin_information cai_test_data ON cai_test_data.account_id = a.clinic_id AND cai_test_data.deleted_at IS NULL
      LEFT JOIN clinic_manager_information cmi ON cmi.account_id = a.clinic_id AND cmi.deleted_at IS NULL
      LEFT JOIN doctor_information di ON di.account_id = a.doctor_id AND di.deleted_at IS NULL
      LEFT JOIN appointment_package ap ON ap.appointment_id = a._id AND ap.deleted_at IS NULL
      LEFT JOIN service_appointments sa ON sa.appointment_package_id = ap._id AND sa.deleted_at IS NULL
      LEFT JOIN clinic_service_config csc ON csc._id = sa.clinic_service_id AND csc.deleted_at IS NULL
      LEFT JOIN clinic_services cs ON cs._id = csc.service_id AND cs.deleted_at IS NULL
      LEFT JOIN (
          SELECT DISTINCT ON (account_id) * FROM addresses
          WHERE deleted_at IS NULL ORDER BY account_id, created_at DESC
      ) ad_m ON ad_m.account_id = a.clinic_id
      LEFT JOIN (
          SELECT DISTINCT ON (account_id) * FROM addresses
          WHERE deleted_at IS NULL ORDER BY account_id, created_at DESC
      ) ad_a ON ad_a.account_id = cacc.parent_id
      WHERE a.deleted_at IS NULL
        AND a.status = 'CONFIRMED'
        AND a.is_remider = false
        AND a.appointment_hour >= NOW()
        AND a.appointment_hour <= NOW() + INTERVAL '24 hours'
      GROUP BY
          a._id, a.patient_id, a.appointment_date, a.appointment_hour, a.status,
          ga.full_name, p.username, p.phone, p.email,
          cai_chuan_br.clinic_name, cai_test_data.clinic_name, cmi.clinic_branch_name,
          cacc.phone, cai_chuan_br.clinic_phone, cai_test_data.clinic_phone,
          ad_m.address, ad_a.address,
          ad_m.ward_name, ad_a.ward_name,
          ad_m.district_name, ad_a.district_name,
          ad_m.province_name, ad_a.province_name,
          di.full_name
      ORDER BY a.appointment_hour DESC;
    `;
    return this.repository.query(rawQuery);
  }

  /**
   * Mark an appointment as reminded
   *
   * @param id - Appointment UUID
   */
  async markAsReminded(id: string): Promise<void> {
    const result = await this.repository.createQueryBuilder()
      .update(Appointment)
      .set({ isRemider: true })
      .where("_id = :id", { id })
      .execute();
    
    if (result.affected === 0) {
      throw new Error(`No appointment found with ID ${id} to mark as reminded`);
    }
  }
}
