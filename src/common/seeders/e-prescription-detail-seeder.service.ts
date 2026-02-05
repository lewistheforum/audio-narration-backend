import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DetailEPrescription } from '../../modules/prescriptions/entities/detail-e-prescription.entity';
import { EPrescription } from '../../modules/prescriptions/entities/e-prescription.entity';
import { Medicine } from '../../modules/prescriptions/entities/medicine.entity';
import { MedicineRepository } from '../../modules/prescriptions/repositories/medicine.repository';
import {
  PRESCRIPTION_DETAILS_PER_PRESCRIPTION_MIN,
  PRESCRIPTION_DETAILS_PER_PRESCRIPTION_MAX,
  getRandomInt,
  getRandomItem,
  PRESCRIPTION_CHECKOUT_NOTES,
  PRESCRIPTION_NOTES,
} from '../constants/appointment-seeder-data';

/**
 * E-Prescription Detail Seeder Service
 *
 * Seeds prescription detail records (medicines) for e-prescriptions.
 * Creates 1..M prescription detail rows per prescription.
 *
 * Seeding Rules:
 * - Each detail references a valid medicine row
 * - Links to valid e-prescriptions
 * - 1..M details per prescription (random between min and max)
 *
 * Idempotent: Uses check-then-insert pattern
 */
@Injectable()
export class EPrescriptionDetailSeederService {
  private readonly logger = new Logger(EPrescriptionDetailSeederService.name);

  constructor(
    @InjectRepository(DetailEPrescription)
    private readonly detailEPrescriptionRepository: Repository<DetailEPrescription>,
    @InjectRepository(EPrescription)
    private readonly ePrescriptionRepository: Repository<EPrescription>,
    private readonly medicineRepository: MedicineRepository,
  ) {}

  /**
   * Seed prescription details for all e-prescriptions
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed e-prescription details...');

      // Step 1: Fetch all e-prescriptions
      const ePrescriptions = await this.ePrescriptionRepository.find();

      if (ePrescriptions.length === 0) {
        this.logger.warn('No e-prescriptions found. Skipping e-prescription detail seeding.');
        return;
      }

      this.logger.log(`Found ${ePrescriptions.length} e-prescriptions`);

      // Step 2: Fetch all medicines
      const medicines = await this.medicineRepository.findAllMedicines();

      if (medicines.length === 0) {
        this.logger.warn('No medicines found. Skipping e-prescription detail seeding.');
        this.logger.warn('⚠️  Please run: pnpm run script:bulk-import-medicines');
        return;
      }

      this.logger.log(`Found ${medicines.length} medicines`);

      // Step 3: Create prescription details for each e-prescription
      let createdCount = 0;
      let skippedCount = 0;

      for (const ePrescription of ePrescriptions) {
        // Check if prescription details already exist for this e-prescription
        const existingDetails = await this.detailEPrescriptionRepository.find({
          where: { ePrescriptionId: ePrescription._id },
        });

        if (existingDetails.length > 0) {
          skippedCount += existingDetails.length;
          continue;
        }

        // Determine number of details for this prescription
        const numDetails = getRandomInt(
          PRESCRIPTION_DETAILS_PER_PRESCRIPTION_MIN,
          PRESCRIPTION_DETAILS_PER_PRESCRIPTION_MAX,
        );

        // Create prescription details
        for (let i = 0; i < numDetails; i++) {
          // Pick random medicine
          const medicine = getRandomItem(medicines);

          // Pick random checkout note
          const checkOut = getRandomItem(PRESCRIPTION_CHECKOUT_NOTES);

          // Create detail
          const detail = this.detailEPrescriptionRepository.create({
            ePrescriptionId: ePrescription._id,
            medicineId: medicine.id,
            checkOut,
            quantity: getRandomInt(1, 30),
            note: Math.random() > 0.5 ? getRandomItem(PRESCRIPTION_NOTES) : null,
          });

          await this.detailEPrescriptionRepository.save(detail);
          createdCount++;
        }
      }

      this.logger.log(`✅ Created ${createdCount} e-prescription details`);
      this.logger.log(`ℹ️  Skipped ${skippedCount} existing e-prescription details`);
      this.logger.log('✅ E-prescription detail seeding completed successfully');
    } catch (error) {
      this.logger.error('Failed to seed e-prescription details', error.stack);
      throw error;
    }
  }

  /**
   * Get all e-prescription details (for validation purposes)
   *
   * @returns Array of all e-prescription detail records
   */
  async getAllEPrescriptionDetails(): Promise<DetailEPrescription[]> {
    return this.detailEPrescriptionRepository.find({
      relations: ['ePrescription', 'medicine'],
    });
  }

  /**
   * Validate e-prescription detail data integrity
   *
   * Checks:
   * - All details reference valid e-prescriptions
   * - All details reference valid medicines
   * - Every e-prescription has at least 1 detail
   *
   * @returns Validation result with any errors found
   */
  async validateEPrescriptionDetails(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const details = await this.getAllEPrescriptionDetails();

    // Get all e-prescriptions
    const ePrescriptions = await this.ePrescriptionRepository.find();
    const ePrescriptionIds = new Set(ePrescriptions.map((p) => p._id));

    // Get all medicines
    const medicines = await this.medicineRepository.findAllMedicines();
    const medicineIds = new Set(medicines.map((m) => m.id));

    // Check: All details reference valid e-prescriptions
    for (const detail of details) {
      if (!ePrescriptionIds.has(detail.ePrescriptionId)) {
        errors.push(
          `E-prescription detail ${detail._id} references non-existent e-prescription: ${detail.ePrescriptionId}`,
        );
      }

      // Check: All details reference valid medicines
      if (!medicineIds.has(detail.medicineId)) {
        errors.push(
          `E-prescription detail ${detail._id} references non-existent medicine: ${detail.medicineId}`,
        );
      }
    }

    // Check: Every e-prescription has at least 1 detail
    const detailsByPrescription = new Map<string, number>();
    for (const detail of details) {
      const count = detailsByPrescription.get(detail.ePrescriptionId) || 0;
      detailsByPrescription.set(detail.ePrescriptionId, count + 1);
    }

    for (const ePrescription of ePrescriptions) {
      const count = detailsByPrescription.get(ePrescription._id) || 0;
      if (count === 0) {
        errors.push(
          `E-prescription ${ePrescription._id} has no details. Every e-prescription must have at least 1 detail.`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
