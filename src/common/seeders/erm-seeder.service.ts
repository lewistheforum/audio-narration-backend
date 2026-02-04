import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ERM } from '../../modules/prescriptions/entities/erm.entity';
import { ServiceAppointment } from '../../modules/appointments/entities/service-appointment.entity';
import { Appointment } from '../../modules/appointments/entities/appointment.entity';
import { ERMStatus, ERMRecordType } from '../../modules/prescriptions/enums';
import {
  ERMS_PER_APPOINTMENT_MIN,
  ERMS_PER_APPOINTMENT_MAX,
  VALID_ERM_STATUSES,
  ERM_RECORD_TYPES,
  getRandomInt,
  getRandomItem,
  getRandomERMDescription,
  SERVICE_CODES,
} from '../constants/appointment-seeder-data';

/**
 * ERM Seeder Service
 *
 * Seeds Electronic Medical Records for completed appointments.
 * Creates 1..K ERMs per appointment (one per service appointment).
 *
 * Seeding Rules:
 * - ERM status must be COMPLETED or SIGNED (never DRAFT/IN_PROGRESS/CANCELLED)
 * - Links to valid service_appointments and appointments
 * - Uses valid record_type values
 *
 * Idempotent: Uses check-then-insert pattern
 */
@Injectable()
export class ERMSeederService {
  private readonly logger = new Logger(ERMSeederService.name);

  constructor(
    @InjectRepository(ERM)
    private readonly ermRepository: Repository<ERM>,
    @InjectRepository(ServiceAppointment)
    private readonly serviceAppointmentRepository: Repository<ServiceAppointment>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  /**
   * Seed ERM records for all service appointments
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed ERMs...');

      // Step 1: Fetch all service appointments with relations
      const serviceAppointments = await this.serviceAppointmentRepository.find({
        relations: ['appointmentPackage', 'erm'],
      });

      if (serviceAppointments.length === 0) {
        this.logger.warn('No service appointments found. Skipping ERM seeding.');
        return;
      }

      this.logger.log(`Found ${serviceAppointments.length} service appointments`);

      // Step 2: Create ERMs for service appointments that don't have one
      let createdCount = 0;
      let skippedCount = 0;

      for (const serviceAppointment of serviceAppointments) {
        // Check if ERM already exists for this service appointment
        if (serviceAppointment.erm) {
          skippedCount++;
          continue;
        }

        // Get the appointment from the package
        const appointmentPackage = serviceAppointment.appointmentPackage;
        if (!appointmentPackage) {
          this.logger.warn(
            `Service appointment ${serviceAppointment._id} has no package. Skipping ERM creation.`,
          );
          continue;
        }

        // Get the appointment for this package
        const appointment = await this.appointmentRepository.findOne({
          where: { _id: appointmentPackage.appointmentId },
        });

        if (!appointment) {
          this.logger.warn(
            `No appointment found for package ${appointmentPackage._id}. Skipping ERM creation.`,
          );
          continue;
        }

        // Verify appointment is COMPLETED
        if (appointment.status !== 'COMPLETED') {
          this.logger.warn(
            `Appointment ${appointment._id} is not COMPLETED. Skipping ERM creation.`,
          );
          continue;
        }

        // Create ERM
        const erm = this.createERM(serviceAppointment, appointment);
        await this.ermRepository.save(erm);
        createdCount++;
      }

      this.logger.log(`✅ Created ${createdCount} ERMs`);
      this.logger.log(`ℹ️  Skipped ${skippedCount} existing ERMs`);
      this.logger.log('✅ ERM seeding completed successfully');
    } catch (error) {
      this.logger.error('Failed to seed ERMs', error.stack);
      throw error;
    }
  }

  /**
   * Create an ERM entity for a service appointment
   *
   * @param serviceAppointment - The service appointment to create ERM for
   * @param appointment - The parent appointment
   * @returns ERM entity
   */
  private createERM(
    serviceAppointment: ServiceAppointment,
    appointment: Appointment,
  ): ERM {
    // Pick random record type
    const recordType = getRandomItem(ERM_RECORD_TYPES);

    // Pick random valid status (COMPLETED or SIGNED)
    const status = getRandomItem(VALID_ERM_STATUSES);

    // Pick random service code
    const serviceCode = getRandomItem(SERVICE_CODES);

    // Get a doctor ID from the appointment or use clinic ID as fallback
    // Assumption: createdBy should reference a doctor account
    // Option A: Use appointment.doctorId if available
    // Option B: Use appointment.clinicId as fallback
    const createdBy = appointment.doctorId || appointment.clinicId;

    // Generate signed_at timestamp if status is SIGNED
    const signedAt = status === ERMStatus.SIGNED ? new Date() : null;

    return this.ermRepository.create({
      serviceAppointmentsId: serviceAppointment._id,
      appointmentId: appointment._id,
      recordType,
      serviceCode,
      status,
      createdBy,
      signedAt,
      // updatedBy is optional, not setting for seeded data
    });
  }

  /**
   * Get all ERMs (for validation purposes)
   *
   * @returns Array of all ERM records
   */
  async getAllERMs(): Promise<ERM[]> {
    return this.ermRepository.find({
      relations: ['serviceAppointment', 'appointment'],
    });
  }

  /**
   * Validate ERM data integrity
   *
   * Checks:
   * - All ERMs have valid status (COMPLETED or SIGNED)
   * - All ERMs reference valid appointments
   * - All ERMs reference valid service appointments
   *
   * @returns Validation result with any errors found
   */
  async validateERMs(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const erms = await this.getAllERMs();

    for (const erm of erms) {
      // Check status
      if (!VALID_ERM_STATUSES.includes(erm.status as ERMStatus)) {
        errors.push(
          `ERM ${erm._id} has invalid status: ${erm.status}. Must be COMPLETED or SIGNED.`,
        );
      }

      // Check appointment exists
      if (!erm.appointment) {
        errors.push(`ERM ${erm._id} references non-existent appointment: ${erm.appointmentId}`);
      } else if (erm.appointment.status !== 'COMPLETED') {
        errors.push(
          `ERM ${erm._id} references appointment ${erm.appointmentId} with status ${erm.appointment.status}. Must be COMPLETED.`,
        );
      }

      // Check service appointment exists
      if (!erm.serviceAppointment) {
        errors.push(
          `ERM ${erm._id} references non-existent service appointment: ${erm.serviceAppointmentsId}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
