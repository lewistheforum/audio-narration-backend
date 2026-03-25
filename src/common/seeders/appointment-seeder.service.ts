import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { Appointment } from '../../modules/appointments/entities/appointment.entity';
import { AppointmentPackage } from '../../modules/appointments/entities/appointment-package.entity';
import { ServiceAppointment } from '../../modules/appointments/entities/service-appointment.entity';
import {
  AppointmentStatus,
  AppointmentPackageStatus,
  PaymentType,
} from '../../modules/appointments/enums';
import { Account } from '../../modules/accounts/entities/accounts.entity';
import { AccountRepository } from '../../modules/accounts/repositories/account.repository';
import { AccountRole } from '../../modules/accounts/enums';
import { ClinicServiceConfigRepository } from '../../modules/service-configs/repositories/clinic-service-config.repository';
import { EmployeeScheduleRepository } from '../../modules/schedules/repositories/employee-schedule.repository';
import { ClinicRoomRepository } from '../../modules/schedules/repositories/clinic-room.repository';
import { ClinicSubscriptionRepository } from '../../modules/subscriptions/repositories/clinic-subscription.repository';
import {
  Transaction,
  PaymentStatus,
  PaymentDirection,
} from '../../modules/transactions/entities/transaction.entity';
import {
  TransactionType,
  TransactionTypeCode,
} from '../../modules/transactions/entities/transaction-type.entity';
import {
  APPOINTMENTS_PER_PATIENT,
  APPOINTMENT_STATUS,
  SERVICES_PER_APPOINTMENT_MAX,
  SERVICES_PER_APPOINTMENT_MIN,
  APPOINTMENT_DAYS_PAST_MAX,
  APPOINTMENT_DAYS_PAST_MIN,
  getRandomInt,
  getRandomPastDate,
  getRandomItem,
  getRandomPackageAmount,
  PATIENT_NOTES,
  APPOINTMENT_PACKAGE_STATUSES,
  PAYMENT_TYPES,
  APPOINTMENT_DIAGNOSES,
} from '../constants/appointment-seeder-data';
import { getVietnamTimestamp, VIETNAM_TIMEZONE } from '../utils/date.util';
import dayjs from 'dayjs';

type ShiftHourAssignment = {
  clinicShiftHourId: string;
  startHour: string;
  endHour: string;
};

type ClinicRoomAssignment = {
  roomId: string;
  roomName: string;
};

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
  private readonly OVERTIME_APPOINTMENTS_PER_PATIENT = 1;

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(AppointmentPackage)
    private readonly appointmentPackageRepository: Repository<AppointmentPackage>,
    @InjectRepository(ServiceAppointment)
    private readonly serviceAppointmentRepository: Repository<ServiceAppointment>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionType)
    private readonly transactionTypeRepository: Repository<TransactionType>,
    private readonly accountRepository: AccountRepository,
    private readonly clinicServiceConfigRepository: ClinicServiceConfigRepository,
    private readonly employeeScheduleRepository: EmployeeScheduleRepository,
    private readonly clinicRoomRepository: ClinicRoomRepository,
    private readonly clinicSubscriptionRepository: ClinicSubscriptionRepository,
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
        .then((accounts) =>
          accounts.filter((acc) => acc.role === AccountRole.PATIENT),
        );

      // Get all CLINIC_ADMIN accounts (sorted by creation - first one is Admin 1)
      const clinicAdmins = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts
            .filter((acc) => acc.role === AccountRole.CLINIC_ADMIN)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        );
      
      // Get Admin 1's ID for SEPAY transactions
      const admin1Id = clinicAdmins.length > 0 ? clinicAdmins[0]._id : null;
      const clinicAdminIds = clinicAdmins.map(admin => admin._id);

      // Get active subscriptions
      const activeClinicIds =
        await this.clinicSubscriptionRepository.findActiveClinicIds();

      const clinics = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts.filter(
            (acc) =>
              acc.role === AccountRole.CLINIC_MANAGER &&
              activeClinicIds.includes(acc.parentId),
          ),
        );

      const doctors = await this.accountRepository
        .findAllAccounts()
        .then((accounts) =>
          accounts.filter((acc) => acc.role === AccountRole.DOCTOR),
        );

      // Validate required data exists
      if (patients.length === 0) {
        throw new Error(
          'No PATIENT accounts found. Please run account seeder first.',
        );
      }
      if (clinics.length === 0) {
        throw new Error(
          'No CLINIC_MANAGER accounts found. Please run account seeder first.',
        );
      }

      this.logger.log(
        `Found ${patients.length} patients, ${clinics.length} clinics, ${doctors.length} doctors`,
      );

      const shiftAssignmentsByClinicDoctor =
        await this.buildShiftAssignmentsByClinicDoctor(doctors);

      if (shiftAssignmentsByClinicDoctor.size === 0) {
        throw new Error(
          'No doctor shift-hour assignments found. Please run clinic shift and employee schedule seeders first.',
        );
      }

      const clinicsWithAssignableDoctors = clinics.filter((clinic) =>
        doctors.some((doctor) =>
          shiftAssignmentsByClinicDoctor.has(
            this.getClinicDoctorKey(clinic._id, doctor._id),
          ),
        ),
      );

      if (clinicsWithAssignableDoctors.length === 0) {
        throw new Error(
          'No clinics have doctors linked to clinic shift hours. Cannot seed consistent appointments.',
        );
      }

      const clinicRoomsByClinic = await this.buildClinicRoomsByClinic(
        clinicsWithAssignableDoctors,
      );

      const clinicsWithOvertimeCapacity = clinicsWithAssignableDoctors.filter(
        (clinic) => (clinicRoomsByClinic.get(clinic._id)?.length ?? 0) > 0,
      );

      if (clinicsWithOvertimeCapacity.length === 0) {
        throw new Error(
          'No clinics with valid clinic_room records were found. Cannot seed overtime appointments consistently.',
        );
      }

      // Step 2: Fetch all clinic service configs
      const serviceConfigs = await this.clinicServiceConfigRepository.findAll();
      if (serviceConfigs.length === 0) {
        throw new Error(
          'No ClinicServiceConfig records found. Please run service config seeder first.',
        );
      }
      this.logger.log(`Found ${serviceConfigs.length} service configs`);

      // Fetch transaction types for appointment packages
      const onlineTxType = await this.transactionTypeRepository.findOne({
        where: { code: TransactionTypeCode.ONLINE },
      });
      const cashTxType = await this.transactionTypeRepository.findOne({
        where: { code: TransactionTypeCode.CASH },
      });

      if (!onlineTxType || !cashTxType) {
        this.logger.warn(
          'Transaction types ONLINE or CASH not found. Please run seed-transaction-types first.',
        );
      }

      const txTypes = { online: onlineTxType, cash: cashTxType };

      // Step 3: Create appointments for each patient
      const appointmentsCreated: Appointment[] = [];
      let overtimeAppointmentsCreated = 0;
      for (const patient of patients) {
        const patientAppointments = await this.seedAppointmentsForPatient(
          patient,
          clinicsWithAssignableDoctors,
          doctors,
          serviceConfigs,
          shiftAssignmentsByClinicDoctor,
          txTypes,
          clinicAdminIds,
        );
        appointmentsCreated.push(...patientAppointments);

        const overtimeAppointments =
          await this.seedOvertimeAppointmentsForPatient(
            patient,
            clinicsWithOvertimeCapacity,
            doctors,
            shiftAssignmentsByClinicDoctor,
            clinicRoomsByClinic,
            serviceConfigs,
            txTypes,
            clinicAdminIds,
          );
        overtimeAppointmentsCreated += overtimeAppointments.length;
        appointmentsCreated.push(...overtimeAppointments);
      }

      this.logger.log(`✅ Created ${appointmentsCreated.length} appointments`);
      this.logger.log(
        `✅ Created ${overtimeAppointmentsCreated} overtime appointments with extra_hour/extra_room_id`,
      );
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
   * @param clinicAdminIds - Array of CLINIC_ADMIN IDs to check if clinic belongs to Admin 1
   * @returns Array of created appointments
   */
  private async seedAppointmentsForPatient(
    patient: Account,
    clinics: Account[],
    doctors: Account[],
    serviceConfigs: any[],
    shiftAssignmentsByClinicDoctor: Map<string, ShiftHourAssignment[]>,
    txTypes: { online: TransactionType; cash: TransactionType },
    clinicAdminIds: string[],
  ): Promise<Appointment[]> {
    const appointments: Appointment[] = [];
    const numAppointments = APPOINTMENTS_PER_PATIENT;

    for (let i = 0; i < numAppointments; i++) {
      // Check if appointment already exists for this patient at this index
      const existing = await this.findExistingAppointment(patient._id, i);
      if (existing) {
        const ensuredAppointment = await this.ensureAppointmentShiftHour(
          existing,
          shiftAssignmentsByClinicDoctor,
        );
        appointments.push(ensuredAppointment);
        continue;
      }

      const clinicOptions = clinics
        .map((clinic) => {
          const clinicDoctors = doctors.filter(
            (doc) =>
              doc.parentId === clinic._id &&
              shiftAssignmentsByClinicDoctor.has(
                this.getClinicDoctorKey(clinic._id, doc._id),
              ),
          );

          return {
            clinic,
            clinicDoctors,
          };
        })
        .filter((option) => option.clinicDoctors.length > 0);

      if (clinicOptions.length === 0) {
        throw new Error(
          'No clinic/doctor combinations with clinic shift hours were found for appointment seeding.',
        );
      }

      const selectedClinicOption = getRandomItem(clinicOptions);
      const clinic = selectedClinicOption.clinic;
      const doctor = getRandomItem(selectedClinicOption.clinicDoctors);
      const shiftAssignments = shiftAssignmentsByClinicDoctor.get(
        this.getClinicDoctorKey(clinic._id, doctor._id),
      );

      if (!shiftAssignments || shiftAssignments.length === 0) {
        throw new Error(
          `Doctor ${doctor._id} at clinic ${clinic._id} has no clinic shift hour assignments.`,
        );
      }

      const shiftAssignment = getRandomItem(shiftAssignments);

      // Generate appointment date in the past
      const appointmentDate = getRandomPastDate(
        APPOINTMENT_DAYS_PAST_MIN,
        APPOINTMENT_DAYS_PAST_MAX,
      );
      const appointmentHour = this.buildAppointmentHourForShift(
        appointmentDate,
        shiftAssignment,
      );

      // Create appointment
      const appointment = this.appointmentRepository.create({
        patientId: patient._id,
        clinicId: clinic._id,
        doctorId: doctor._id,
        clinicShiftHourId: shiftAssignment.clinicShiftHourId,
        appointmentDate,
        appointmentHour,
        extraHour: null,
        total: getRandomPackageAmount() / 100, // Convert to numeric
        status: APPOINTMENT_STATUS,
        isRemider: getRandomInt(0, 1) === 1,
        patientNote: getRandomItem(PATIENT_NOTES),
        rejectReason: null,
        diagnosis: getRandomItem(APPOINTMENT_DIAGNOSES),
      });

      const savedAppointment =
        await this.appointmentRepository.save(appointment);
      appointments.push(savedAppointment);

      // Create appointment package and services
      await this.createAppointmentPackageAndServices(
        savedAppointment,
        clinic,
        serviceConfigs,
        txTypes,
        clinicAdminIds,
      );
    }

    return appointments;
  }

  private async ensureAppointmentShiftHour(
    appointment: Appointment,
    shiftAssignmentsByClinicDoctor: Map<string, ShiftHourAssignment[]>,
  ): Promise<Appointment> {
    if (appointment.clinicShiftHourId) {
      return appointment;
    }

    if (!appointment.doctorId) {
      throw new Error(
        `Appointment ${appointment._id} has no doctor assigned. Cannot derive clinic_shift_hour_id consistently.`,
      );
    }

    const shiftAssignments = shiftAssignmentsByClinicDoctor.get(
      this.getClinicDoctorKey(appointment.clinicId, appointment.doctorId),
    );

    if (!shiftAssignments || shiftAssignments.length === 0) {
      throw new Error(
        `No shift hour assignment found for appointment ${appointment._id} (clinic ${appointment.clinicId}, doctor ${appointment.doctorId}).`,
      );
    }

    const shiftAssignment = getRandomItem(shiftAssignments);
    appointment.clinicShiftHourId = shiftAssignment.clinicShiftHourId;
    appointment.appointmentHour = this.buildAppointmentHourForShift(
      appointment.appointmentDate,
      shiftAssignment,
    );

    return this.appointmentRepository.save(appointment);
  }

  private async seedOvertimeAppointmentsForPatient(
    patient: Account,
    clinics: Account[],
    doctors: Account[],
    shiftAssignmentsByClinicDoctor: Map<string, ShiftHourAssignment[]>,
    clinicRoomsByClinic: Map<string, ClinicRoomAssignment[]>,
    serviceConfigs: any[],
    txTypes: { online: TransactionType | null; cash: TransactionType | null },
    clinicAdminIds: string[],
  ): Promise<Appointment[]> {
    const overtimeAppointments: Appointment[] = [];

    for (let i = 0; i < this.OVERTIME_APPOINTMENTS_PER_PATIENT; i++) {
      const existing = await this.findExistingOvertimeAppointment(
        patient._id,
        i,
      );
      if (existing) {
        overtimeAppointments.push(existing);
        continue;
      }

      const clinicOptions = clinics
        .map((clinic) => {
          const clinicDoctors = doctors.filter(
            (doc) =>
              doc.parentId === clinic._id &&
              shiftAssignmentsByClinicDoctor.has(
                this.getClinicDoctorKey(clinic._id, doc._id),
              ),
          );

          return {
            clinic,
            clinicDoctors,
            clinicRooms: clinicRoomsByClinic.get(clinic._id) || [],
          };
        })
        .filter(
          (option) =>
            option.clinicDoctors.length > 0 && option.clinicRooms.length > 0,
        );

      if (clinicOptions.length === 0) {
        throw new Error(
          'No clinic/doctor/room combinations with clinic_room records were found for overtime appointment seeding.',
        );
      }

      const selectedClinicOption = getRandomItem(clinicOptions);
      const clinic = selectedClinicOption.clinic;
      const doctor = getRandomItem(selectedClinicOption.clinicDoctors);
      const room = getRandomItem(selectedClinicOption.clinicRooms);
      const extraHour = this.buildOvertimeExtraHour();
      const appointmentDate = dayjs(extraHour)
        .tz(VIETNAM_TIMEZONE)
        .startOf('day')
        .toDate();

      const overtimeAppointment = this.appointmentRepository.create({
        patientId: patient._id,
        clinicId: clinic._id,
        doctorId: doctor._id,
        clinicShiftHourId: null,
        appointmentDate,
        appointmentHour: null as unknown as Date,
        extraHour,
        extraRoomId: room.roomId,
        total: getRandomPackageAmount() / 100,
        status: AppointmentStatus.PENDING,
        isRemider: getRandomInt(0, 1) === 1,
        patientNote: `${getRandomItem(PATIENT_NOTES)} ${this.getOvertimeSeedMarker(i)}`,
        rejectReason: null,
        diagnosis: null, // PENDING appointments do not have a diagnosis yet
      });

      const savedAppointment =
        await this.appointmentRepository.save(overtimeAppointment);
      overtimeAppointments.push(savedAppointment);

      // Create appointment package and services for overtime appointment
      await this.createAppointmentPackageAndServices(
        savedAppointment,
        clinic,
        serviceConfigs,
        txTypes,
        clinicAdminIds,
      );

      // Update the appointment total with the calculated package amount
      const pkg = await this.appointmentPackageRepository.findOne({
        where: { appointmentId: savedAppointment._id },
      });
      if (pkg) {
        savedAppointment.total = pkg.amount;
        await this.appointmentRepository.save(savedAppointment);
      }

      this.logger.log(
        `Created overtime appointment ${savedAppointment._id} for patient ${patient._id} in clinic ${clinic._id} using extra room ${room.roomName} (${room.roomId})`,
      );
    }

    return overtimeAppointments;
  }

  private async buildShiftAssignmentsByClinicDoctor(
    doctors: Account[],
  ): Promise<Map<string, ShiftHourAssignment[]>> {
    const assignments = new Map<string, ShiftHourAssignment[]>();

    if (doctors.length === 0) {
      return assignments;
    }

    const rows = await this.employeeScheduleRepository
      .createQueryBuilder('schedule')
      .select('schedule.employeeId', 'doctorId')
      .addSelect('schedule.clinicId', 'clinicId')
      .addSelect('shiftHour._id', 'clinicShiftHourId')
      .addSelect('shiftHour.startHour', 'startHour')
      .addSelect('shiftHour.endHour', 'endHour')
      .innerJoin('schedule.clinicShift', 'clinicShift')
      .innerJoin('clinicShift.hours', 'shiftHour')
      .where('schedule.employeeId IN (:...doctorIds)', {
        doctorIds: doctors.map((doctor) => doctor._id),
      })
      .andWhere('schedule.deletedAt IS NULL')
      .andWhere('clinicShift.deletedAt IS NULL')
      .andWhere('shiftHour.deletedAt IS NULL')
      .groupBy('schedule.employeeId')
      .addGroupBy('schedule.clinicId')
      .addGroupBy('shiftHour._id')
      .addGroupBy('shiftHour.startHour')
      .addGroupBy('shiftHour.endHour')
      .orderBy('shiftHour.startHour', 'ASC')
      .getRawMany<{
        doctorId: string;
        clinicId: string;
        clinicShiftHourId: string;
        startHour: string;
        endHour: string;
      }>();

    for (const row of rows) {
      const key = this.getClinicDoctorKey(row.clinicId, row.doctorId);
      const existingAssignments = assignments.get(key) || [];

      existingAssignments.push({
        clinicShiftHourId: row.clinicShiftHourId,
        startHour: row.startHour,
        endHour: row.endHour,
      });

      assignments.set(key, existingAssignments);
    }

    return assignments;
  }

  private async buildClinicRoomsByClinic(
    clinics: Account[],
  ): Promise<Map<string, ClinicRoomAssignment[]>> {
    const roomsByClinic = new Map<string, ClinicRoomAssignment[]>();

    if (clinics.length === 0) {
      return roomsByClinic;
    }

    const rooms = await this.clinicRoomRepository.find({
      where: {
        clinicId: In(clinics.map((clinic) => clinic._id)),
      },
      order: {
        roomName: 'ASC',
      },
    });

    for (const room of rooms) {
      const clinicRooms = roomsByClinic.get(room.clinicId) || [];
      clinicRooms.push({
        roomId: room._id,
        roomName: room.roomName,
      });
      roomsByClinic.set(room.clinicId, clinicRooms);
    }

    return roomsByClinic;
  }

  private getClinicDoctorKey(clinicId: string, doctorId: string): string {
    return `${clinicId}:${doctorId}`;
  }

  private getOvertimeSeedMarker(index: number): string {
    return `[OVERTIME_SEED_${index + 1}]`;
  }

  private buildAppointmentHourForShift(
    appointmentDate: Date,
    shiftAssignment: ShiftHourAssignment,
  ): Date {
    const [startHour, startMinute] = shiftAssignment.startHour
      .split(':')
      .map((value) => parseInt(value, 10));
    const [endHour, endMinute] = shiftAssignment.endHour
      .split(':')
      .map((value) => parseInt(value, 10));

    const startInMinutes = startHour * 60 + startMinute;
    const endInMinutes = endHour * 60 + endMinute;
    const quarterSlots = Math.max(
      1,
      Math.floor((endInMinutes - startInMinutes) / 15),
    );
    const quarterOffset = getRandomInt(0, quarterSlots - 1);
    const totalMinutes = startInMinutes + quarterOffset * 15;

    return dayjs(appointmentDate)
      .tz(VIETNAM_TIMEZONE)
      .hour(Math.floor(totalMinutes / 60))
      .minute(totalMinutes % 60)
      .second(0)
      .millisecond(0)
      .toDate();
  }

  private buildOvertimeExtraHour(): Date {
    const dayOffset = getRandomInt(1, 21);
    const overtimeHour = getRandomInt(18, 20);
    const overtimeMinute = getRandomInt(0, 3) * 15;

    return dayjs()
      .tz(VIETNAM_TIMEZONE)
      .add(dayOffset, 'day')
      .hour(overtimeHour)
      .minute(overtimeMinute)
      .second(0)
      .millisecond(0)
      .toDate();
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

  private async findExistingOvertimeAppointment(
    patientId: string,
    index: number,
  ): Promise<Appointment | null> {
    return this.appointmentRepository.findOne({
      where: {
        patientId,
        status: AppointmentStatus.PENDING,
        patientNote: Like(`%${this.getOvertimeSeedMarker(index)}%`),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  /**
   * Create appointment package and service appointments
   *
   * @param appointment - The appointment to create package for
   * @param clinic - The clinic account
   * @param serviceConfigs - Available service configs
   * @param clinicAdminIds - Array of CLINIC_ADMIN IDs to check if clinic belongs to Admin 1
   */
  private async createAppointmentPackageAndServices(
    appointment: Appointment,
    clinic: any,
    serviceConfigs: any[],
    txTypes: { online: TransactionType; cash: TransactionType },
    clinicAdminIds?: string[],
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

    // Determine if this clinic belongs to Admin 1 (first CLINIC_ADMIN)
    const isAdmin1Clinic = clinicAdminIds && clinicAdminIds.length > 0 && clinic.parentId === clinicAdminIds[0];

    // Determine number of services
    const numServices = getRandomInt(
      SERVICES_PER_APPOINTMENT_MIN,
      SERVICES_PER_APPOINTMENT_MAX,
    );

    const amount = getRandomPackageAmount();
    const status = getRandomItem(APPOINTMENT_PACKAGE_STATUSES);
    const paymentType = getRandomItem(PAYMENT_TYPES);
    let transactionId = null;

    if (
      status === AppointmentPackageStatus.PAID &&
      txTypes.online &&
      txTypes.cash
    ) {
      const txType =
        paymentType === PaymentType.ONLINE ? txTypes.online : txTypes.cash;
      // Use SEPAY for Admin 1 clinics, otherwise use ONLINE/CASH based on payment type
      const gateway = isAdmin1Clinic ? 'SEPAY' : (paymentType === PaymentType.ONLINE ? 'SEPAY' : 'CASH');
      const transaction = this.transactionRepository.create({
        clinicId: clinic._id,
        transactionTypeId: txType._id,
        amount: amount,
        currency: 'VND',
        status: PaymentStatus.SUCCESS,
        transactionDate: appointment.appointmentDate,
        code: `TRANS-${getVietnamTimestamp()}-${Math.floor(Math.random() * 10000)}`,
        description: `Payment for appointment ${appointment._id} (${paymentType})`,
        transferType: PaymentDirection.IN,
        gateway,
        appointmentId: appointment._id,
      });
      const savedTransaction =
        await this.transactionRepository.save(transaction);
      transactionId = savedTransaction.id;
    }

    // Create appointment package
    const appointmentPackage = this.appointmentPackageRepository.create({
      appointmentId: appointment._id,
      transactionId: transactionId,
      amount: amount,
      status: status,
      paymentType: paymentType,
    });

    const savedPackage =
      await this.appointmentPackageRepository.save(appointmentPackage);

    // Create service appointments
    for (let i = 0; i < numServices; i++) {
      // Pick random service config for this clinic
      const serviceConfig = getRandomItem(clinicServiceConfigs);

      // V4.5: Snapshot price and discount from clinic_service_config
      const basePrice = parseFloat(serviceConfig.price?.toString() || '0');
      const discount = parseFloat(serviceConfig.discount?.toString() || '0');

      const serviceAppointment = this.serviceAppointmentRepository.create({
        clinicServiceId: serviceConfig._id,
        appointmentPackageId: savedPackage._id,
        price: basePrice, // Snapshot: Original service price
        discount, // Snapshot: Discount percentage at time of booking
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
      if (
        appointment.patient &&
        appointment.patient.role !== AccountRole.PATIENT
      ) {
        errors.push(
          `Appointment ${appointment._id} has patient ${appointment.patientId} with role ${appointment.patient.role}. Must be PATIENT.`,
        );
      }

      // Check: reject_reason is NULL for COMPLETED appointments
      if (
        appointment.status === AppointmentStatus.COMPLETED &&
        appointment.rejectReason !== null
      ) {
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
