import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medicine } from '../entities/medicine.entity';

/**
 * Medicine Repository
 *
 * Data access layer for Medicine entity.
 * Implements the Repository Pattern to separate data access logic from business logic.
 *
 * Responsibilities:
 * - Direct database operations (CRUD) for Medicine entity
 * - Query construction and execution
 * - No business logic (handled by PrescriptionsService)
 * - No validation (handled by DTOs and Service)
 *
 * @class MedicineRepository
 * @injectable
 */
@Injectable()
export class MedicineRepository {
  constructor(
    @InjectRepository(Medicine)
    private readonly medicineRepository: Repository<Medicine>,
  ) {}

  /**
   * Create a new medicine
   *
   * @param {Partial<Medicine>} medicineData - Medicine data to create
   * @returns {Promise<Medicine>} Created medicine entity
   */
  async createMedicine(medicineData: Partial<Medicine>): Promise<Medicine> {
    const medicine = this.medicineRepository.create(medicineData);
    return this.medicineRepository.save(medicine);
  }

  /**
   * Find all medicines
   *
   * @returns {Promise<Medicine[]>} Array of all medicine entities
   */
  async findAllMedicines(): Promise<Medicine[]> {
    return this.medicineRepository.find({
      order: { name: 'ASC' },
    });
  }

  /**
   * Find medicine by ID
   *
   * @param {string} id - Medicine UUID
   * @returns {Promise<Medicine | null>} Medicine entity or null if not found
   */
  async findMedicineById(id: string): Promise<Medicine | null> {
    return this.medicineRepository.findOne({
      where: { id },
    });
  }

  /**
   * Search medicines by name (case-insensitive partial match)
   *
   * @param {string} name - Medicine name to search
   * @returns {Promise<Medicine[]>} Array of matching medicines
   */
  async searchMedicinesByName(name: string): Promise<Medicine[]> {
    return this.medicineRepository
      .createQueryBuilder('medicine')
      .where('medicine.name ILIKE :name', { name: `%${name}%` })
      .orderBy('medicine.name', 'ASC')
      .getMany();
  }

  /**
   * Find medicines by therapeutic class
   *
   * @param {string} therapeuticClass - Therapeutic class to filter by
   * @returns {Promise<Medicine[]>} Array of medicines in the therapeutic class
   */
  async findMedicinesByTherapeuticClass(
    therapeuticClass: string,
  ): Promise<Medicine[]> {
    return this.medicineRepository.find({
      where: { therapeuticClass },
      order: { name: 'ASC' },
    });
  }

  /**
   * Find medicines by chemical class
   *
   * @param {string} chemicalClass - Chemical class to filter by
   * @returns {Promise<Medicine[]>} Array of medicines in the chemical class
   */
  async findMedicinesByChemicalClass(
    chemicalClass: string,
  ): Promise<Medicine[]> {
    return this.medicineRepository.find({
      where: { chemicalClass },
      order: { name: 'ASC' },
    });
  }

  /**
   * Find medicines by action class
   *
   * @param {string} actionClass - Action class to filter by
   * @returns {Promise<Medicine[]>} Array of medicines in the action class
   */
  async findMedicinesByActionClass(actionClass: string): Promise<Medicine[]> {
    return this.medicineRepository.find({
      where: { actionClass },
      order: { name: 'ASC' },
    });
  }

  /**
   * Find habit-forming medicines (controlled substances)
   *
   * @returns {Promise<Medicine[]>} Array of habit-forming medicines
   */
  async findHabitFormingMedicines(): Promise<Medicine[]> {
    return this.medicineRepository.find({
      where: { habitForming: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Update medicine
   *
   * @param {string} id - Medicine UUID
   * @param {Partial<Medicine>} updateData - Data to update
   * @returns {Promise<Medicine | null>} Updated medicine entity or null
   */
  async updateMedicine(
    id: string,
    updateData: Partial<Medicine>,
  ): Promise<Medicine | null> {
    await this.medicineRepository.update(id, updateData);
    return this.findMedicineById(id);
  }

  /**
   * Soft delete medicine
   *
   * @param {string} id - Medicine UUID
   * @returns {Promise<void>}
   */
  async softDeleteMedicine(id: string): Promise<void> {
    await this.medicineRepository.softDelete(id);
  }

  /**
   * Restore soft-deleted medicine
   *
   * @param {string} id - Medicine UUID
   * @returns {Promise<void>}
   */
  async restoreMedicine(id: string): Promise<void> {
    await this.medicineRepository.restore(id);
  }

  /**
   * Hard delete medicine
   *
   * @param {string} id - Medicine UUID
   * @returns {Promise<void>}
   */
  async hardDeleteMedicine(id: string): Promise<void> {
    await this.medicineRepository.delete(id);
  }

  /**
   * Count total medicines
   *
   * @returns {Promise<number>} Total count of medicines
   */
  async countMedicines(): Promise<number> {
    return this.medicineRepository.count();
  }

  /**
   * Find medicines with pagination
   *
   * @param {number} skip - Number of records to skip
   * @param {number} take - Number of records to take
   * @returns {Promise<[Medicine[], number]>} Array of medicines and total count
   */
  async findMedicinesWithPagination(
    skip: number,
    take: number,
  ): Promise<[Medicine[], number]> {
    return this.medicineRepository.findAndCount({
      order: { name: 'ASC' },
      skip,
      take,
    });
  }
}
