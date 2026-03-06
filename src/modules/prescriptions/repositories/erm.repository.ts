import { Injectable } from '@nestjs/common';
import { DataSource, Repository, DeepPartial } from 'typeorm';
import { ERM } from '../entities/erm.entity';
import { ERMConsultation } from '../entities/erm-consultation.entity';
import { ERMXray } from '../entities/erm-xray.entity';
import { ERMUltrasound } from '../entities/erm-ultrasound.entity';
import { ERMLab } from '../entities/erm-lab.entity';
import { ERMProcedure } from '../entities/erm-procedure.entity';
import { ERMBoneDensity } from '../entities/erm-bone-density.entity';

/**
 * ERM Repository
 *
 * Data access layer for ERM (Electronic Medical Records) entities.
 * Implements the Repository Pattern to separate data access logic from business logic.
 *
 * Responsibilities:
 * - Direct database operations (CRUD) for ERM and related entities
 * - Query construction and execution
 * - No business logic (handled by ErmsService)
 * - No validation (handled by DTOs and Service)
 *
 * @class ErmRepository
 * @injectable
 */
@Injectable()
export class ErmRepository {
  private ermRepository: Repository<ERM>;
  private consultationRepository: Repository<ERMConsultation>;
  private xrayRepository: Repository<ERMXray>;
  private ultrasoundRepository: Repository<ERMUltrasound>;
  private labRepository: Repository<ERMLab>;
  private procedureRepository: Repository<ERMProcedure>;
  private boneDensityRepository: Repository<ERMBoneDensity>;

  constructor(private readonly dataSource: DataSource) {
    this.ermRepository = this.dataSource.getRepository(ERM);
    this.consultationRepository = this.dataSource.getRepository(ERMConsultation);
    this.xrayRepository = this.dataSource.getRepository(ERMXray);
    this.ultrasoundRepository = this.dataSource.getRepository(ERMUltrasound);
    this.labRepository = this.dataSource.getRepository(ERMLab);
    this.procedureRepository = this.dataSource.getRepository(ERMProcedure);
    this.boneDensityRepository = this.dataSource.getRepository(ERMBoneDensity);
  }

  // ============= ERM Main Entity Operations =============

  /**
   * Create a new ERM record
   *
   * @param {DeepPartial<ERM>} ermData - ERM data to create
   * @returns {Promise<ERM>} Created ERM entity
   */
  async createErm(ermData: DeepPartial<ERM>): Promise<ERM> {
    const erm = this.ermRepository.create(ermData);
    return this.ermRepository.save(erm);
  }

  /**
   * Find ERM by ID
   *
   * @param {string} ermId - ERM UUID
   * @returns {Promise<ERM | null>} ERM entity or null if not found
   */
  async findErmById(ermId: string): Promise<ERM | null> {
    return this.ermRepository
      .createQueryBuilder('erm')
      .where('erm._id = :ermId', { ermId })
      .andWhere('erm.deleted_at IS NULL')
      .getOne();
  }

  /**
   * Find ERM with appointment relation
   *
   * @param {string} ermId - ERM UUID
   * @returns {Promise<ERM | null>} ERM entity with appointment or null
   */
  async findErmWithAppointment(ermId: string): Promise<ERM | null> {
    return this.ermRepository
      .createQueryBuilder('erm')
      .leftJoinAndSelect('erm.appointment', 'appointment')
      .where('erm._id = :ermId', { ermId })
      .andWhere('erm.deleted_at IS NULL')
      .getOne();
  }

  /**
   * Save ERM (create or update)
   *
   * @param {ERM} erm - ERM entity to save
   * @returns {Promise<ERM>} Saved ERM entity
   */
  async saveErm(erm: ERM): Promise<ERM> {
    return this.ermRepository.save(erm);
  }

  // ============= Consultation Operations =============

  /**
   * Find consultation data by ERM ID
   *
   * @param {string} ermId - ERM UUID
   * @returns {Promise<ERMConsultation | null>}
   */
  async findConsultationByErmId(ermId: string): Promise<ERMConsultation | null> {
    return this.consultationRepository.findOne({ where: { ermId } });
  }

  /**
   * Save consultation data (create or update)
   *
   * @param {string} ermId - ERM UUID
   * @param {any} data - Consultation data
   * @returns {Promise<ERMConsultation>}
   */
  async saveConsultationData(ermId: string, data: any): Promise<ERMConsultation> {
    const existing = await this.findConsultationByErmId(ermId);

    if (existing) {
      Object.assign(existing, data);
      return this.consultationRepository.save(existing);
    } else {
      return this.consultationRepository.save({
        ermId,
        ...data,
      } as DeepPartial<ERMConsultation>);
    }
  }

  // ============= X-ray Operations =============

  /**
   * Find X-ray data by ERM ID
   *
   * @param {string} ermId - ERM UUID
   * @returns {Promise<ERMXray | null>}
   */
  async findXrayByErmId(ermId: string): Promise<ERMXray | null> {
    return this.xrayRepository.findOne({ where: { ermId } });
  }

  /**
   * Save X-ray data (create or update)
   *
   * @param {string} ermId - ERM UUID
   * @param {any} data - X-ray data
   * @returns {Promise<ERMXray>}
   */
  async saveXrayData(ermId: string, data: any): Promise<ERMXray> {
    const existing = await this.findXrayByErmId(ermId);

    if (existing) {
      Object.assign(existing, data);
      return this.xrayRepository.save(existing);
    } else {
      return this.xrayRepository.save({
        ermId,
        ...data,
      } as DeepPartial<ERMXray>);
    }
  }

  // ============= Ultrasound Operations =============

  /**
   * Find Ultrasound data by ERM ID
   *
   * @param {string} ermId - ERM UUID
   * @returns {Promise<ERMUltrasound | null>}
   */
  async findUltrasoundByErmId(ermId: string): Promise<ERMUltrasound | null> {
    return this.ultrasoundRepository.findOne({ where: { ermId } });
  }

  /**
   * Save Ultrasound data (create or update)
   *
   * @param {string} ermId - ERM UUID
   * @param {any} data - Ultrasound data
   * @returns {Promise<ERMUltrasound>}
   */
  async saveUltrasoundData(ermId: string, data: any): Promise<ERMUltrasound> {
    const existing = await this.findUltrasoundByErmId(ermId);

    if (existing) {
      Object.assign(existing, data);
      return this.ultrasoundRepository.save(existing);
    } else {
      return this.ultrasoundRepository.save({
        ermId,
        ...data,
      } as DeepPartial<ERMUltrasound>);
    }
  }

  // ============= Lab Operations =============

  /**
   * Find Lab data by ERM ID
   *
   * @param {string} ermId - ERM UUID
   * @returns {Promise<ERMLab | null>}
   */
  async findLabByErmId(ermId: string): Promise<ERMLab | null> {
    return this.labRepository.findOne({ where: { ermId } });
  }

  /**
   * Save Lab data (create or update)
   *
   * @param {string} ermId - ERM UUID
   * @param {any} data - Lab data
   * @returns {Promise<ERMLab>}
   */
  async saveLabData(ermId: string, data: any): Promise<ERMLab> {
    const existing = await this.findLabByErmId(ermId);

    if (existing) {
      Object.assign(existing, data);
      return this.labRepository.save(existing);
    } else {
      return this.labRepository.save({
        ermId,
        ...data,
      } as DeepPartial<ERMLab>);
    }
  }

  // ============= Procedure Operations =============

  /**
   * Find Procedure data by ERM ID
   *
   * @param {string} ermId - ERM UUID
   * @returns {Promise<ERMProcedure | null>}
   */
  async findProcedureByErmId(ermId: string): Promise<ERMProcedure | null> {
    return this.procedureRepository.findOne({ where: { ermId } });
  }

  /**
   * Save Procedure data (create or update)
   *
   * @param {string} ermId - ERM UUID
   * @param {any} data - Procedure data
   * @returns {Promise<ERMProcedure>}
   */
  async saveProcedureData(ermId: string, data: any): Promise<ERMProcedure> {
    const existing = await this.findProcedureByErmId(ermId);

    if (existing) {
      Object.assign(existing, data);
      return this.procedureRepository.save(existing);
    } else {
      return this.procedureRepository.save({
        ermId,
        ...data,
      } as DeepPartial<ERMProcedure>);
    }
  }

  // ============= Bone Density Operations =============

  /**
   * Find Bone Density data by ERM ID
   *
   * @param {string} ermId - ERM UUID
   * @returns {Promise<ERMBoneDensity | null>}
   */
  async findBoneDensityByErmId(ermId: string): Promise<ERMBoneDensity | null> {
    return this.boneDensityRepository.findOne({ where: { ermId } });
  }

  /**
   * Save Bone Density data (create or update)
   *
   * @param {string} ermId - ERM UUID
   * @param {any} data - Bone Density data
   * @returns {Promise<ERMBoneDensity>}
   */
  async saveBoneDensityData(ermId: string, data: any): Promise<ERMBoneDensity> {
    const existing = await this.findBoneDensityByErmId(ermId);

    if (existing) {
      Object.assign(existing, data);
      return this.boneDensityRepository.save(existing);
    } else {
      return this.boneDensityRepository.save({
        ermId,
        ...data,
      } as DeepPartial<ERMBoneDensity>);
    }
  }
}
