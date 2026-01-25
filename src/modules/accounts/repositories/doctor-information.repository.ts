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
        'doctor_info.accountId',
        'doctor_info.fullName',
        'doctor_info.gender',
        'doctor_info.dob',
        'doctor_info.profilePicture',
        'doctor_info.academicDegree',
        'doctor_info.experience',
        'doctor_info.position',
        'doctor_info.introduction1',
        'doctor_info.workProcess2',
        'doctor_info.studyProcess3',
        'doctor_info.members4',
        'doctor_info.scientificWork5',
        'doctor_info.papers6',
        'doctor_info.introductionImage',
        'doctor_info.createdAt',
        'doctor_info.updatedAt',
      ])
      .addSelect([
        'doctor_info.professionalLicense',
        'doctor_info.certificatePracticalTraining',
        'doctor_info.medicalLicense',
      ])
      .where('doctor_info.accountId = :accountId', { accountId: doctorAccId })
      .getOne();
  }
}
