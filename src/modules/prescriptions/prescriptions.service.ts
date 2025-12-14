import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medicine } from './entities/medicine.entity';
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
    @InjectRepository(Medicine)
    private readonly medicineRepository: Repository<Medicine>,
  ) {}

  /**
   * Create a new medicine record
   */
  async create(createMedicineDto: CreateMedicineDto): Promise<Medicine> {
    const medicine = this.medicineRepository.create(createMedicineDto);
    return await this.medicineRepository.save(medicine);
  }

  /**
   * Find all medicines (with soft-deleted excluded by default)
   */
  async findAll(): Promise<Medicine[]> {
    return await this.medicineRepository.find({
      order: { name: 'ASC' },
    });
  }

  /**
   * Find medicine by ID
   */
  async findOne(id: string): Promise<Medicine> {
    return await this.medicineRepository.findOne({
      where: { id },
    });
  }

  /**
   * Search medicines by name (partial match)
   */
  async searchByName(name: string): Promise<Medicine[]> {
    return await this.medicineRepository
      .createQueryBuilder('medicine')
      .where('medicine.name ILIKE :name', { name: `%${name}%` })
      .orderBy('medicine.name', 'ASC')
      .getMany();
  }

  /**
   * Find medicines by therapeutic class
   */
  async findByTherapeuticClass(therapeuticClass: string): Promise<Medicine[]> {
    return await this.medicineRepository.find({
      where: { therapeuticClass },
      order: { name: 'ASC' },
    });
  }

  /**
   * Find habit-forming medicines (controlled substances)
   */
  async findHabitForming(): Promise<Medicine[]> {
    return await this.medicineRepository.find({
      where: { habitForming: true },
      order: { name: 'ASC' },
    });
  }

  /**
   * Update medicine record
   */
  async update(id: string, updateMedicineDto: UpdateMedicineDto): Promise<Medicine> {
    await this.medicineRepository.update(id, updateMedicineDto);
    return await this.findOne(id);
  }

  /**
   * Soft delete medicine record
   */
  async remove(id: string): Promise<void> {
    await this.medicineRepository.softDelete(id);
  }

  /**
   * Restore soft-deleted medicine
   */
  async restore(id: string): Promise<void> {
    await this.medicineRepository.restore(id);
  }

  /**
   * Permanently delete medicine record
   */
  async permanentDelete(id: string): Promise<void> {
    await this.medicineRepository.delete(id);
  }
}
