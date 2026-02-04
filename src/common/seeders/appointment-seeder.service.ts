import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../../modules/appointments/entities/appointment.entity';
import { AppointmentPackage } from '../../modules/appointments/entities/appointment-package.entity';
import { ServiceAppointment } from '../../modules/appointments/entities/service-appointment.entity';
import { AppointmentStatus } from '../../modules/appointments/enums';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { AccountRole } from '../../modules/accounts/enums';
import { ClinicServiceConfigRepository } from '../../modules/service-configs/repositories/clinic-service-config.repository';
import {
  APPOINTMENTS_PER_PATIENT,
  APPOINTMENT_STATUS,
  SERVICES_PER_APPOINTMENT_MAX,
  SERVICES_PER_APPOINTMENT_MIN,
  APPOINTMENT_DAYS_PAST_MAX,
  APPOINTMENT_DAYS_PAST_MIN,
  getRandomInt,
  getRandomPastDate,
  getRandomAppointmentHour,
  getRandomItem,
  getRandomPackageAmount,
  PATIENT_NOTES,
  APPOINTMENT_PACKAGE_STATUSES,
  PAYMENT_TYPES,
} from '../constants/appointment-seeder-data';

/**
 * Appointment Seeder Service
 *
 * Seeds completed appointments with their dependent entities:
 * - appointments (COMPLETED status only)
 * - appointment_package records
 * - service_appointments records
 *
 * Seeding Order:
 * 1. Fetch PATIENT accounts (required)
 * 2. Fetch CLINIC_MANAGER accounts (clinics)
 * 3. Fetch DOCTOR accounts (optional, nullable)
 * 4. Fetch ClinicServiceConfig records for services
 * 5. Create appointments with packages and services
 *
 * Idempotent: Uses check-then-insert pattern
 */
@Injectable()
export class AppointmentSeederService {
  private readonly logger = new Logger(AppointmentSeederService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(AppointmentPackage)
    private readonly appointmentPackageRepository: Repository<AppointmentPackage>,
    @InjectRepository(ServiceAppointment)
    private readonly serviceAppointmentRepository: Repository<ServiceAppointment>,
    private readonly accountRepository: AccountRepository,
    private readonly clinicServiceConfigRepository: ClinicServiceConfigRepository,
  ) {}

  /**
   * Seed all appointment-related data
   *
   * This method is called by SeederOrchestratorService during application bootstrap.
   */
  async seed(): Promise<void> {
    try {
      this.logger.log('Starting to seed appointments...');

      // Step 1: Fetch required accounts
      const patients = await this.accountRepository
        .findAllAccounts()
        .then((accounts) => accounts.filter((acc) => acc.role === AccountRole.PATIENT));

      const clinics = await this.accountRepository
        .findAllAccounts()
        .then((accounts) => accounts.filter((acc) => acc.role === AccountRole.CLINIC_MANAGER));

      const doctors = await this.accountRepository
        .findAllAccounts()
        .then((accounts) => accounts.filter((acc) => acc.role === AccountRole.DOCTOR));

      // Validate required data exists
      if (patients.length === 0) {
        throw new Error('No PATIENT accounts found. Please run account seeder first.');
      }
      if (clinics.length === 0) {
        throw new Error('No CLINIC_MANAGER accounts found. Please run account seeder first.');
      }

      this.logger.log(`Found ${patients.length} patients, ${clinics.length} clinics, ${doctors.length} doctors`);

      // Step 2: Fetch all clinic service configs
      const serviceConfigs = await this.clinicServiceConfigRepository.findAll();
      if (serviceConfigs.length === 0) {
        throw new Error('No ClinicServiceConfig records found. Please run service config seeder first.');
      }
      this.logger.log(`Found ${serviceConfigs.length} service configs`);

      // Step 3: Create appointments for each patient
      const appointmentsCreated: Appointment[] = [];
      for (const patient of patients) {
        const patientAppointments = await this.seedAppointmentsForPatient(
          patient,
          clinics,
          doctors,
          serviceConfigs,
        );
        appointmentsCreated.push(...patientAppointments);
      }

      this.logger.log(`✅ Created ${appointmentsCreated.length} appointments`);
      this.logger.log('✅ Appointment seeding completed successfully');
    } catch (error) {
      this.logger.error('Failed to seed appointments', error.stack);
      throw error;
    }
  }

  /**
   * Seed appointments for a single patient
   *
   * @param patient - Patient account
   * @param clinics - Available clinic accounts
   * @param doctors - Available doctor accounts
   * @param serviceConfigs - Available service configs
   * @returns Array of created appointments
   */
  private async seedAppointmentsForPatient(
    patient: any,
    clinics: any[],
    doctors: any[],
    serviceConfigs: any[],
  ): Promise<Appointment[]> {
    const appointments: Appointment[] = [];
    const numAppointments = APPOINTMENTS_PER_PATIENT;

    for (let i = 0; i < numAppointments; i++) {
      // Check if appointment already exists for this patient at this index
      const existing = await this.findExistingAppointment(patient._id, i);
      if (existing) {
        appointments.push(existing);
        continue;
      }

      // Pick random clinic
      const clinic = getRandomItem(clinics);

      // Pick random doctor (nullable)
      const doctor = doctors.length > 0 ? getRandomItem(doctors) : null;

      // Generate appointment date in the past
      const appointmentDate = getRandomPastDate(APPOINTMENT_DAYS_PAST_MIN, APPOINTMENT_DAYS_PAST_MAX);
      const appointmentHour = getRandomAppointmentHour(appointmentDate);

      // Create appointment
      const appointment = this.appointmentRepository.create({
        patientId: patient._id,
        clinicId: clinic._id,
        doctorId: doctor?._id || null,
        doctorShiftHourId: null, // Not setting shift hour for seeded appointments
        appointmentDate,
        appointmentHour,
        extraHour: null,
        total: getRandomPackageAmount() / 100, // Convert to numeric
        status: APPOINTMENT_STATUS,
        isRemider: getRandomInt(0, 1) === 1,
        patientNote: getRandomItem(PATIENT_NOTES),
        rejectReason: null, // Must be null for COMPLETED appointments
      });

      const savedAppointment = await this.appointmentRepository.save(appointment);
      appointments.push(savedAppointment);

      // Create appointment package and services
      await this.createAppointmentPackageAndServices(savedAppointment, clinic, serviceConfigs);
    }

    return appointments;
  }

  /**
   * Find existing appointment for a patient at a specific index
   * This is a simple idempotency check based on patient and creation order
   *
   * @param patientId - Patient account ID
   * @param index - Appointment index for this patient
   * @returns Existing appointment or null
   */
  private async findExistingAppointment(
    patientId: string,
    index: number,
  ): Promise<Appointment | null> {
    // Find all completed appointments for this patient
    const appointments = await this.appointmentRepository.find({
      where: {
        patientId,
        status: AppointmentStatus.COMPLETED,
      },
      order: {
        createdAt: 'ASC',
      },
    });

    // If we already have enough appointments for this patient, return the one at this index
    if (appointments.length > index) {
      return appointments[index];
    }

    return null;
  }

  /**
   * Create appointment package and service appointments
   *
   * @param appointment - The appointment to create package for
   * @param clinic - The clinic account
   * @param serviceConfigs - Available service configs
   */
  private async createAppointmentPackageAndServices(
    appointment: Appointment,
    clinic: any,
    serviceConfigs: any[],
  ): Promise<void> {
    // Check if package already exists
    const existingPackage = await this.appointmentPackageRepository.findOne({
      where: { appointmentId: appointment._id },
    });

    if (existingPackage) {
      return; // Skip if already exists
    }

    // Get service configs for this clinic
    const clinicServiceConfigs = serviceConfigs.filter(
      (config) => config.clinicId === clinic._id,
    );

    if (clinicServiceConfigs.length === 0) {
      this.logger.warn(
        `No service configs found for clinic ${clinic._id}. Skipping services for appointment ${appointment._id}`,
      );
      return;
    }

    // Determine number of services
    const numServices = getRandomInt(SERVICES_PER_APPOINTMENT_MIN, SERVICES_PER_APPOINTMENT_MAX);

    // Create appointment package
    const appointmentPackage = this.appointmentPackageRepository.create({
      appointmentId: appointment._id,
      transactionId: null, // Not linking to transactions for seeded data
      amount: getRandomPackageAmount(),
      status: getRandomItem(APPOINTMENT_PACKAGE_STATUSES),
      paymentType: getRandomItem(PAYMENT_TYPES),
    });

    const savedPackage = await this.appointmentPackageRepository.save(appointmentPackage);

    // Create service appointments
    for (let i = 0; i < numServices; i++) {
      // Pick random service config for this clinic
      const serviceConfig = getRandomItem(clinicServiceConfigs);

      const serviceAppointment = this.serviceAppointmentRepository.create({
        clinicServiceId: serviceConfig._id,
        appointmentPackageId: savedPackage._id,
      });

      await this.serviceAppointmentRepository.save(serviceAppointment);
    }
  }

  /**
   * Get all created appointments (for use by other seeders)
   *
   * @returns Array of all COMPLETED appointments
   */
  async getAllCompletedAppointments(): Promise<Appointment[]> {
    return this.appointmentRepository.find({
      where: {
        status: AppointmentStatus.COMPLETED,
      },
      relations: ['patient', 'clinic', 'doctor'],
    });
  }

  /**
   * Get all service appointments (for use by ERM seeder)
   *
   * @returns Array of all service appointments with relations
   */
  async getAllServiceAppointments(): Promise<ServiceAppointment[]> {
    return this.serviceAppointmentRepository.find({
      relations: ['appointmentPackage', 'clinicService'],
    });
  }

  /**
   * Validate appointment data integrity
   *
   * Checks:
   * - Every appointment has status COMPLETED
   * - Every appointment's patient account has role PATIENT
   * - reject_reason is NULL for COMPLETED appointments
   *
   * @returns Validation result with any errors found
   */
  async validateAppointments(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const appointments = await this.appointmentRepository.find({
      relations: ['patient'],
    });

    for (const appointment of appointments) {
      // Check: Appointment status is COMPLETED
      if (appointment.status !== AppointmentStatus.COMPLETED) {
        errors.push(
          `Appointment ${appointment._id} has status ${appointment.status}. All seeded appointments must be COMPLETED.`,
        );
      }

      // Check: Patient account has role PATIENT
      if (appointment.patient && appointment.patient.role !== AccountRole.PATIENT) {
        errors.push(
          `Appointment ${appointment._id} has patient ${appointment.patientId} with role ${appointment.patient.role}. Must be PATIENT.`,
        );
      }

      // Check: reject_reason is NULL for COMPLETED appointments
      if (appointment.status === AppointmentStatus.COMPLETED && appointment.rejectReason !== null) {
        errors.push(
          `Appointment ${appointment._id} has reject_reason set but status is COMPLETED. reject_reason must be NULL for COMPLETED appointments.`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
