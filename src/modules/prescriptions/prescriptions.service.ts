import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, DeepPartial } from 'typeorm';
import { Medicine } from './entities/medicine.entity';
import { EPrescription } from './entities/e-prescription.entity';
import { DetailEPrescription } from './entities/detail-e-prescription.entity';
import { MedicineRepository } from './repositories';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { CreatePrescriptionDto, PrescriptionResponseDto, PrescriptionMedicineDetailDto } from './dto';
import { Appointment } from '../appointments/entities/appointment.entity';
import { MESSAGES } from '../../common/message';

/**
 * Prescriptions Service
 * 
 * Handles business logic for medicine management and E-Prescriptions
 * 
 * Features:
 * - Medicine CRUD operations
 * - Electronic Prescriptions (E-Prescriptions)
 * - Search by name, therapeutic class
 * - Habit-forming medicines tracking
 * - Soft delete support
 */
@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly medicineRepository: MedicineRepository,
    private readonly dataSource: DataSource,
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

  /**
   * Generate unique reference ID for prescription
   * Format: EP{YYYYMMDD}{SequenceNumber}
   * Example: EP20260224001
   *
   * @returns Generated reference ID
   * @private
   */
  private async generateReferenceId(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `EP${year}${month}${day}`;

    // Count prescriptions created today
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await this.dataSource
      .getRepository(EPrescription)
      .createQueryBuilder('ep')
      .where('ep.created_at >= :startOfDay', { startOfDay })
      .andWhere('ep.created_at <= :endOfDay', { endOfDay })
      .getCount();

    const sequence = String(count + 1).padStart(3, '0');
    return `${datePrefix}${sequence}`;
  }

  /**
   * Create or update electronic prescription (Step 7)
   *
   * Implements upsert logic:
   * - If prescription exists: soft delete old details and create new ones
   * - If not exists: create new prescription with details
   *
   * @param appointmentId - Appointment UUID
   * @param createPrescriptionDto - Prescription data with medicines
   * @param doctorId - Doctor UUID (for permission check)
   * @returns Created/updated prescription details
   * @throws NotFoundException if appointment or medicines not found
   * @throws BadRequestException if validation fails
   */
  async createOrUpdatePrescription(
    appointmentId: string,
    createPrescriptionDto: CreatePrescriptionDto,
    doctorId: string,
  ): Promise<PrescriptionResponseDto> {
    const { doctorNote, medicines } = createPrescriptionDto;

    // Find appointment with doctor check
    const appointment = await this.dataSource
      .getRepository(Appointment)
      .findOne({
        where: { _id: appointmentId },
      });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Verify doctor has permission
    if (appointment.doctorId !== doctorId) {
      throw new BadRequestException('You do not have permission to create prescription for this appointment');
    }

    // Check appointment status
    if (appointment.status !== 'IN_PROGRESS' && appointment.status !== 'CHECKED_IN') {
      throw new BadRequestException('Can only create/update prescription when appointment is IN_PROGRESS or CHECKED_IN');
    }

    // Validate all medicines exist and not deleted
    const medicineIds = medicines.map(m => m.medicineId);
    const validMedicines = await this.dataSource
      .getRepository(Medicine)
      .createQueryBuilder('medicine')
      .where('medicine.id IN (:...medicineIds)', { medicineIds })
      .andWhere('medicine.deleted_at IS NULL')
      .getMany();

    if (validMedicines.length !== medicineIds.length) {
      const foundIds = validMedicines.map(m => m.id);
      const missingIds = medicineIds.filter(id => !foundIds.includes(id));
      throw new NotFoundException(`Medicines not found or deleted: ${missingIds.join(', ')}`);
    }

    // Check for habit-forming medicines
    const habitFormingMedicines = validMedicines.filter(m => m.habitForming);
    const hasHabitForming = habitFormingMedicines.length > 0;

    if (hasHabitForming) {
      console.warn(
        `[PRESCRIPTION] Habit-forming medicines detected in prescription for appointment ${appointmentId}:`,
        habitFormingMedicines.map(m => m.name).join(', ')
      );
    }

    // Check if prescription already exists
    const existingPrescription = await this.dataSource
      .getRepository(EPrescription)
      .findOne({
        where: { appointmentId },
      });

    let prescription: EPrescription;

    if (existingPrescription) {
      // UPDATE logic: Soft delete old details
      await this.dataSource
        .getRepository(DetailEPrescription)
        .createQueryBuilder()
        .softDelete()
        .where('e_prescription_id = :prescriptionId', { prescriptionId: existingPrescription._id })
        .execute();

      // Update prescription (updatedAt will be set automatically by @UpdateDateColumn)
      existingPrescription.doctorNote = doctorNote;
      prescription = await this.dataSource.getRepository(EPrescription).save(existingPrescription);
    } else {
      // CREATE logic: Generate reference ID and create new prescription
      const referenceId = await this.generateReferenceId();
      
      const newPrescription = this.dataSource.getRepository(EPrescription).create({
        appointmentId,
        referenceId,
        doctorNote,
      });

      prescription = await this.dataSource.getRepository(EPrescription).save(newPrescription);
    }

    // Create new detail records
    const detailRecords = medicines.map(med => ({
      ePrescriptionId: prescription._id,
      medicineId: med.medicineId,
      checkOut: med.checkOut,
    }));

    await this.dataSource
      .getRepository(DetailEPrescription)
      .save(detailRecords);

    // Fetch complete prescription with details
    return this.getPrescription(appointmentId, doctorId);
  }

  /**
   * Get electronic prescription for appointment (Step 7.1)
   *
   * Retrieves prescription with all medicine details
   *
   * @param appointmentId - Appointment UUID
   * @param doctorId - Doctor UUID (for permission check)
   * @returns Prescription details
   * @throws NotFoundException if appointment or prescription not found
   */
  async getPrescription(
    appointmentId: string,
    doctorId: string,
  ): Promise<PrescriptionResponseDto> {
    // Find appointment with doctor check
    const appointment = await this.dataSource
      .getRepository(Appointment)
      .findOne({
        where: { _id: appointmentId },
      });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Verify doctor has permission
    if (appointment.doctorId !== doctorId) {
      throw new BadRequestException('You do not have permission to view this prescription');
    }

    // Find prescription
    const prescription = await this.dataSource
      .getRepository(EPrescription)
      .findOne({
        where: { appointmentId },
      });

    if (!prescription) {
      throw new NotFoundException('Prescription not found for this appointment');
    }

    // Get all details with medicine info
    const details = await this.dataSource
      .getRepository(DetailEPrescription)
      .createQueryBuilder('detail')
      .leftJoinAndSelect('detail.medicine', 'medicine')
      .where('detail.e_prescription_id = :prescriptionId', { prescriptionId: prescription._id })
      .andWhere('detail.deleted_at IS NULL')
      .getMany();

    // Map to response DTOs
    const medicineDetails: PrescriptionMedicineDetailDto[] = details.map(detail => ({
      detailId: detail._id,
      medicineId: detail.medicineId,
      medicineName: detail.medicine?.name || 'Unknown Medicine',
      habitForming: detail.medicine?.habitForming || false,
      checkOut: detail.checkOut || '',
    }));

    const hasHabitFormingMedicines = medicineDetails.some(m => m.habitForming);

    return {
      ePrescriptionId: prescription._id,
      appointmentId: prescription.appointmentId,
      referenceId: prescription.referenceId || '',
      doctorNote: prescription.doctorNote,
      medicines: medicineDetails,
      hasHabitFormingMedicines,
      createdAt: prescription.createdAt,
      updatedAt: prescription.updatedAt,
    };
  }
}


