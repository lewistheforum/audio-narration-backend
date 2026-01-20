import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { DoctorInformation } from '../entities/doctor_information.entity';

/**
 * DoctorInformation Repository
 *
 * Handles all direct database operations for the DoctorInformation entity.
 * This layer is responsible for data access only, no business logic.
 */
@Injectable()
export class DoctorInformationRepository {
  constructor(
    @InjectRepository(DoctorInformation)
    private readonly repository: Repository<DoctorInformation>,
  ) {}

  /**
   * Find all doctor information records
   */
  async findAll(includeDeleted: boolean = false): Promise<DoctorInformation[]> {
    return this.repository.find({
      withDeleted: includeDeleted,
    });
  }

  /**
   * Find doctor information by ID
   */
  async findById(id: string): Promise<DoctorInformation | null> {
    return this.repository.findOne({
      where: { _id: id },
    });
  }

  /**
   * Find doctor information by doctor account ID
   */
  async findByDoctorAccountId(
    doctorAccId: string,
  ): Promise<DoctorInformation | null> {
    return this.repository.findOne({
      where: { accountId: doctorAccId },
    });
  }

  /**
   * Find doctor information by doctor account ID including soft-deleted
   */
  async findByDoctorAccountIdWithDeleted(
    doctorAccId: string,
  ): Promise<DoctorInformation | null> {
    return this.repository.findOne({
      where: { accountId: doctorAccId },
      withDeleted: true,
    });
  }

  /**
   * Create doctor information entity (without saving)
   */
  create(data: DeepPartial<DoctorInformation>): DoctorInformation {
    return this.repository.create(data);
  }

  /**
   * Save doctor information entity
   */
  async save(doctorInfo: DoctorInformation): Promise<DoctorInformation> {
    return this.repository.save(doctorInfo);
  }

  /**
   * Update doctor information by ID
   */
  async update(
    id: string,
    data: DeepPartial<DoctorInformation>,
  ): Promise<DoctorInformation | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * Update doctor information by doctor account ID
   */
  async updateByDoctorAccountId(
    doctorAccId: string,
    data: DeepPartial<DoctorInformation>,
  ): Promise<DoctorInformation | null> {
    await this.repository.update({ accountId: doctorAccId }, data);
    return this.findByDoctorAccountId(doctorAccId);
  }

  /**
   * Soft delete doctor information
   */
  async softDelete(id: string): Promise<void> {
    await this.repository.softDelete(id);
  }

  /**
   * Soft delete doctor information by doctor account ID
   */
  async softDeleteByDoctorAccountId(doctorAccId: string): Promise<void> {
    await this.repository.softDelete({ accountId: doctorAccId });
  }

  /**
   * Hard delete doctor information
   */
  async delete(id: string): Promise<number> {
    const result = await this.repository.delete(id);
    return result.affected || 0;
  }

  /**
   * Hard delete doctor information by doctor account ID
   */
  async deleteByDoctorAccountId(doctorAccId: string): Promise<number> {
    const result = await this.repository.delete({ accountId: doctorAccId });
    return result.affected || 0;
  }

  /**
   * Restore soft-deleted doctor information
   */
  async restore(id: string): Promise<void> {
    await this.repository.restore(id);
  }

  /**
   * Restore soft-deleted doctor information by doctor account ID
   */
  async restoreByDoctorAccountId(doctorAccId: string): Promise<void> {
    await this.repository.restore({ accountId: doctorAccId });
  }

  /**
   * Check if doctor information exists by doctor account ID
   */
  async existsByDoctorAccountId(doctorAccId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { accountId: doctorAccId },
    });
    return count > 0;
  }

  /**
   * Find public doctor information by doctor account ID
   *
   * Returns doctor information with security controls on encrypted fields.
   * Uses allowlist approach to prevent sensitive data leakage.
   *
   * Allowed encrypted fields (using addSelect):
   * - professional_license
   * - certificate_practical_training
   * - medical_license
   *
   * Excluded encrypted fields (NOT selected):
   * - identity_number
   * - place_identity_card
   * - identity_date
   * - bank_number
   * - bank_name
   * - bank_branch
   *
   * @param {string} doctorAccId - Doctor account UUID
   * @returns {Promise<DoctorInformation | null>} Doctor information with allowed fields only
   */
  async findPublicByDoctorAccountId(
    doctorAccId: string,
  ): Promise<DoctorInformation | null> {
    return this.repository
      .createQueryBuilder('doctor_info')
      .select([
        'doctor_info._id',
        'doctor_info.account_id',
        'doctor_info.full_name',
        'doctor_info.gender',
        'doctor_info.dob',
        'doctor_info.profile_picture',
        'doctor_info.academic_degree',
        'doctor_info.experience',
        'doctor_info.position',
        'doctor_info.introduction_1',
        'doctor_info.work_process_2',
        'doctor_info.study_process_3',
        'doctor_info.members_4',
        'doctor_info.scientific_work_5',
        'doctor_info.papers_6',
        'doctor_info.introduction_image',
        'doctor_info.created_at',
        'doctor_info.updated_at',
      ])
      .addSelect([
        'doctor_info.professional_license',
        'doctor_info.certificate_practical_training',
        'doctor_info.medical_license',
      ])
      .where('doctor_info.account_id = :accountId', { accountId: doctorAccId })
      .getOne();
  }
}
