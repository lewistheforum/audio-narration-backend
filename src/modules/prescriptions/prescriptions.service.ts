import { Injectable } from '@nestjs/common';
import { Medicine } from './entities/medicine.entity';
import { MedicineRepository } from './repositories';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';

/**
 * Medicine Service
 * 
 * Handles business logic for medicine management
 * Supports ERM (Electronic Medical Records) and E-Prescriptions
 */
@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly medicineRepository: MedicineRepository,
  ) { }

  /**
   * Create a new medicine record
   */
  async create(createMedicineDto: CreateMedicineDto): Promise<Medicine> {
    return await this.medicineRepository.createMedicine(createMedicineDto);
  }

  /**
   * Find all medicines (with soft-deleted excluded by default)
   */
  async findAll(): Promise<Medicine[]> {
    return await this.medicineRepository.findAllMedicines();
  }

  /**
   * Find medicine by ID
   */
  async findOne(id: string): Promise<Medicine> {
    return await this.medicineRepository.findMedicineById(id);
  }

  /**
   * Search medicines by name (partial match)
   */
  async searchByName(name: string): Promise<Medicine[]> {
    return await this.medicineRepository.searchMedicinesByName(name);
  }

  /**
   * Find medicines by therapeutic class
   */
  async findByTherapeuticClass(therapeuticClass: string): Promise<Medicine[]> {
    return await this.medicineRepository.findMedicinesByTherapeuticClass(
      therapeuticClass,
    );
  }

  /**
   * Find habit-forming medicines (controlled substances)
   */
  async findHabitForming(): Promise<Medicine[]> {
    return await this.medicineRepository.findHabitFormingMedicines();
  }

  /**
   * Update medicine record
   */
  async update(id: string, updateMedicineDto: UpdateMedicineDto): Promise<Medicine> {
    return await this.medicineRepository.updateMedicine(id, updateMedicineDto);
  }

  /**
   * Soft delete medicine record
   */
  async remove(id: string): Promise<void> {
    await this.medicineRepository.softDeleteMedicine(id);
  }

  /**
   * Restore soft-deleted medicine
   */
  async restore(id: string): Promise<void> {
    await this.medicineRepository.restoreMedicine(id);
  }

  /**
   * Permanently delete medicine record
   */
  async permanentDelete(id: string): Promise<void> {
    await this.medicineRepository.hardDeleteMedicine(id);
  }
}
