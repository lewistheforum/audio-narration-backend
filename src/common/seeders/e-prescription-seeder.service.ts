import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EPrescription } from '../../modules/prescriptions/entities/e-prescription.entity';
import { Appointment } from '../../modules/appointments/entities/appointment.entity';
import { AppointmentStatus } from '../../modules/appointments/enums';
import {
  getRandomItem,
  PRESCRIPTION_DOCTOR_NOTES,
} from '../constants/appointment-seeder-data';
import { getCurrentVietnamTime } from '../utils/date.util';

// Type extension to include ePrescription relation
interface AppointmentWithPrescription extends Appointment {
  ePrescription?: EPrescription;
}

/**
 * E-Prescription Seeder Service
 *
 * Seeds electronic prescriptions for completed appointments.
 * Creates exactly 1 e_prescription per appointment.
 *
 * Seeding Rules:
 * - Exactly 1 e_prescription per appointment (enforced by unique constraint on appointment_id)
 * - Links to valid COMPLETED appointments
 * - No appointment should end up with 0 or 2 prescriptions
 *
 * Idempotent: Uses check-then-insert pattern
 */
@Injectable()
export class EPrescriptionSeederService {
  private readonly logger = new Logger(EPrescriptionSeederService.name);

  constructor(
    @InjectRepository(EPrescription)
    private readonly ePrescriptionRepository: Repository<EPrescription>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  /**
   * Seed e-prescriptions for all completed appointments
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed e-prescriptions...');

      // Step 1: Fetch all COMPLETED appointments
      const appointments = await this.appointmentRepository.find({
        where: {
          status: AppointmentStatus.COMPLETED,
        },
      });

      // Step 1.5: Fetch existing e-prescriptions to check which appointments already have one
      const existingPrescriptions = await this.ePrescriptionRepository.find();
      const appointmentIdsWithPrescription = new Set(
        existingPrescriptions.map((p) => p.appointmentId),
      );

      if (appointments.length === 0) {
        this.logger.warn('No COMPLETED appointments found. Skipping e-prescription seeding.');
        return;
      }

      this.logger.log(`Found ${appointments.length} COMPLETED appointments`);

      // Step 2: Create e-prescriptions for appointments that don't have one
      let createdCount = 0;
      let skippedCount = 0;

      for (const appointment of appointments) {
        // Check if e-prescription already exists for this appointment
        if (appointmentIdsWithPrescription.has(appointment._id)) {
          skippedCount++;
          continue;
        }

        // Create e-prescription
        const ePrescription = this.createEPrescription(appointment);
        await this.ePrescriptionRepository.save(ePrescription);
        createdCount++;
      }

      this.logger.log(`✅ Created ${createdCount} e-prescriptions`);
      this.logger.log(`ℹ️  Skipped ${skippedCount} existing e-prescriptions`);
      this.logger.log('✅ E-prescription seeding completed successfully');
    } catch (error) {
      this.logger.error('Failed to seed e-prescriptions', error.stack);
      throw error;
    }
  }

  /**
   * Create an e-prescription entity for an appointment
   *
   * @param appointment - The appointment to create e-prescription for
   * @returns EPrescription entity
   */
  private createEPrescription(appointment: Appointment): EPrescription {
    // Generate a reference ID (format: PREC-YYYYMMDD-XXXX)
    const referenceId = this.generateReferenceId();

    // Pick random doctor note
    const doctorNote = getRandomItem(PRESCRIPTION_DOCTOR_NOTES);

    return this.ePrescriptionRepository.create({
      appointmentId: appointment._id,
      referenceId,
      doctorNote,
    });
  }

  /**
   * Generate a unique reference ID for the prescription
   * Format: PREC-YYYYMMDD-XXXX where XXXX is a random 4-digit number
   *
   * @returns Reference ID string
   */
  private generateReferenceId(): string {
    const date = getCurrentVietnamTime();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return `PREC-${year}${month}${day}-${random}`;
  }

  /**
   * Get all e-prescriptions (for validation purposes)
   *
   * @returns Array of all e-prescription records
   */
  async getAllEPrescriptions(): Promise<EPrescription[]> {
    return this.ePrescriptionRepository.find({
      relations: ['appointment'],
    });
  }

  /**
   * Validate e-prescription data integrity
   *
   * Checks:
   * - Every COMPLETED appointment has exactly one e-prescription
   * - All e-prescriptions reference valid appointments
   * - No appointment has 0 or 2 prescriptions
   *
   * @returns Validation result with any errors found
   */
  async validateEPrescriptions(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Get all COMPLETED appointments
    const appointments = await this.appointmentRepository.find({
      where: {
        status: AppointmentStatus.COMPLETED,
      },
    });

    // Get all e-prescriptions
    const ePrescriptions = await this.getAllEPrescriptions();

    // Create a map of appointment IDs to e-prescriptions
    const prescriptionMap = new Map<string, EPrescription[]>();
    for (const ePrescription of ePrescriptions) {
      const existing = prescriptionMap.get(ePrescription.appointmentId) || [];
      existing.push(ePrescription);
      prescriptionMap.set(ePrescription.appointmentId, existing);
    }

    // Check: Every COMPLETED appointment has exactly one e-prescription
    for (const appointment of appointments) {
      const prescriptions = prescriptionMap.get(appointment._id) || [];
      if (prescriptions.length === 0) {
        errors.push(
          `Appointment ${appointment._id} (COMPLETED) has no e-prescription. Every COMPLETED appointment must have exactly one e-prescription.`,
        );
      } else if (prescriptions.length > 1) {
        errors.push(
          `Appointment ${appointment._id} has ${prescriptions.length} e-prescriptions. Must have exactly one e-prescription.`,
        );
      }
    }

    // Check: All e-prescriptions reference valid COMPLETED appointments
    for (const ePrescription of ePrescriptions) {
      if (!ePrescription.appointment) {
        errors.push(
          `E-prescription ${ePrescription._id} references non-existent appointment: ${ePrescription.appointmentId}`,
        );
      } else if (ePrescription.appointment.status !== 'COMPLETED') {
        errors.push(
          `E-prescription ${ePrescription._id} references appointment ${ePrescription.appointmentId} with status ${ePrescription.appointment.status}. Must be COMPLETED.`,
        );
      }
    }

    // Note: Duplicate check is now done in the loop above

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
