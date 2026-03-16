import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { REDIS_CLIENT } from 'src/config/redis.config';
import {
  CreateBookingSessionDto,
  UpdateBookingSessionDto,
  BookingSessionResponseDto,
  BookingOption,
  ServiceInitialDataDto,
  DoctorInitialDataDto,
  DateInitialDataDto,
  OutOfHoursInitialDataDto,
} from './dto';
import { ClinicServiceConfig } from '../service-configs/entities/clinic-service-config.entity';
import { Account } from '../accounts/entities/accounts.entity';
import { AccountRole } from '../accounts/enums';
import {
  getCurrentVietnamTime,
  addToVietnamTime,
  formatToVietnamTime,
  isInPast,
  startOfDay,
} from 'src/common/utils/date.util';

/**
 * Booking Session Interface
 *
 * Represents a booking session stored in Redis
 */
export interface BookingSession {
  sessionId: string;
  patientId: string;
  
  // Data accumulated across steps
  /** V5.0: Multi-service booking - replaces single clinicServiceConfigId */
  serviceIds?: string[]; // Array of clinic_service_config IDs
  clinicId?: string;
  doctorId?: string;
  appointmentDate?: string; // YYYY-MM-DD
  clinicShiftHourId?: string | null; // Nullable for out-of-hours
  extraHour?: string | null; // ISO 8601 with timezone for out-of-hours (Option 4)
  paymentMethod?: 'cod' | 'online'; // NEW in v4.0 - Required before finalizing
  paymentAmount?: number;
  paymentProvider?: string;
  paymentReferenceId?: string;
  patientNote?: string;
  appointmentHour?: string;
  workHistoryId?: string;
  
  // Metadata
  bookingOption: BookingOption;
  createdAt: Date;
  expiresAt: Date;
  currentStep: number;
}

/**
 * Booking Session Service
 *
 * Manages Redis-based booking sessions for the appointment flow.
 * Sessions expire after 30 minutes (1800 seconds).
 *
 * Key features:
 * - Create session with initial data (Step 1)
 * - Update session step-by-step (Steps 2-4)
 * - Retrieve and validate session ownership
 * - Automatic cleanup via Redis TTL
 */
@Injectable()
export class BookingSessionService {
  private readonly SESSION_TTL = 1800; // 30 minutes in seconds
  private readonly KEY_PREFIX = 'booking:session:';

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new booking session
   *
   * @param patientId - Patient account UUID (from JWT)
   * @param createDto - Initial booking data
   * @returns Session ID and initial session data
   * @throws BadRequestException if validation fails
   */
  async createSession(
    patientId: string,
    createDto: CreateBookingSessionDto,
  ): Promise<BookingSessionResponseDto> {
    // Validate initial data based on booking option
    await this.validateInitialData(createDto.booking_option, createDto.initial_data);

    // Generate session ID
    const sessionId = uuidv4();
    const now = getCurrentVietnamTime();
    const expiresAt = addToVietnamTime(this.SESSION_TTL, 'second');

    // Build session object
    const session: BookingSession = {
      sessionId,
      patientId,
      bookingOption: createDto.booking_option,
      createdAt: now,
      expiresAt,
      currentStep: 1,
    };

    // Populate initial data based on booking option
    if (createDto.booking_option === BookingOption.SERVICE) {
      const data = createDto.initial_data as ServiceInitialDataDto;
      // V5.0: Store service_ids as array from initial data
      session.serviceIds = data.service_ids;
      session.clinicId = data.clinic_id;
    } else if (createDto.booking_option === BookingOption.DOCTOR) {
      const data = createDto.initial_data as DoctorInitialDataDto;
      session.doctorId = data.doctor_id;
      if (data.clinic_id) {
        session.clinicId = data.clinic_id;
      }
    } else if (createDto.booking_option === BookingOption.DATE) {
      const data = createDto.initial_data as DateInitialDataDto;
      session.appointmentDate = data.appointment_date;
    } else if (createDto.booking_option === BookingOption.OUT_OF_HOURS) {
      const data = createDto.initial_data as OutOfHoursInitialDataDto;
      if (data.clinic_id) {
        session.clinicId = data.clinic_id;
      }
      // Initialize extraHour as null (will be set in step 2)
      session.extraHour = null;
    }

    // Save to Redis with TTL
    const key = this.getSessionKey(sessionId);
    await this.redisClient.setex(key, this.SESSION_TTL, JSON.stringify(session));

    // Build response
    return this.buildSessionResponse(session);
  }

  /**
   * Update an existing booking session
   *
   * @param sessionId - Session UUID
   * @param patientId - Patient account UUID (for ownership verification)
   * @param updateDto - Update data with step number
   * @returns Updated session data
   * @throws NotFoundException if session not found or expired
   * @throws ForbiddenException if session doesn't belong to patient
   * @throws BadRequestException if step validation fails
   */
  async updateSession(
    sessionId: string,
    patientId: string,
    updateDto: UpdateBookingSessionDto,
  ): Promise<BookingSessionResponseDto> {
    // Retrieve session from Redis
    const session = await this.getSession(sessionId);

    // Verify ownership
    if (session.patientId !== patientId) {
      throw new ForbiddenException('You do not have permission to access this session');
    }

    // Validate step sequence (pass bookingOption for proper validation)
    this.validateStepSequence(session.currentStep, updateDto.step, session.bookingOption);

    // Update session based on booking option and step (VERSION 4.6)
    // FIX: Use Object.assign to explicitly merge new data while preserving all existing fields
    if (session.bookingOption === BookingOption.DATE) {
      // Option 3: Date-first flow (VERSION 4.6 - SWAPPED STEPS 3-4)
      // Step 1 (initial): appointment_date is already set
      // Step 2: Add clinic_id
      // Step 3: Add clinic_shift_hour_id + doctor_id (MOVED UP from V4.4)
      // Step 4: Add clinic_service_config_id (MOVED DOWN from V4.4)
      // Step 5: Add payment_method + patient_note
      if (updateDto.step === 2) {
        const data = updateDto.data as any;
        
        // Validate clinic_id is required
        if (!data.clinic_id) {
          throw new BadRequestException('Clinic ID is required in step 2');
        }
        
        // MERGE: Explicitly preserve all existing fields
        Object.assign(session, {
          clinicId: data.clinic_id,
          currentStep: 2,
        });
      } else if (updateDto.step === 3) {
        const data = updateDto.data as any;
        
        // VERSION 4.6: Step 3 now handles clinic_shift_hour_id + doctor_id
        // Validate required fields
        if (!data.clinic_shift_hour_id) {
          throw new BadRequestException('Clinic shift hour ID is required in step 3');
        }
        if (!data.doctor_id) {
          throw new BadRequestException('Doctor ID is required in step 3');
        }
        
        // MERGE: Explicitly preserve all existing fields
        const updateFields: any = {
          clinicShiftHourId: data.clinic_shift_hour_id,
          doctorId: data.doctor_id,
          currentStep: 3,
        };
        
        // ADDED VERSION 4.0: Save appointment hour
        if (data.appointment_hour) {
          updateFields.appointmentHour = data.appointment_hour;
        }
        
        Object.assign(session, updateFields);
      } else if (updateDto.step === 4) {
        const data = updateDto.data as any;
        
        // VERSION 5.0: Step 4 now handles service_ids (multi-service array)
        if (!data.service_ids || !Array.isArray(data.service_ids) || data.service_ids.length === 0) {
          throw new BadRequestException('service_ids (array) is required in step 4');
        }
        
        // MERGE: Explicitly preserve all existing fields
        Object.assign(session, {
          serviceIds: data.service_ids,
          currentStep: 4,
        });
      } else if (updateDto.step === 5) {
        const data = updateDto.data as any;
        
        // Payment method is REQUIRED
        if (!data.payment_method) {
          throw new BadRequestException('Payment method is required in step 5');
        }
        
        // MERGE: Explicitly preserve all existing fields
        const updateFields: any = {
          paymentMethod: data.payment_method,
          currentStep: 5,
        };
        
        // Patient note is optional
        if (data.patient_note !== undefined) {
          updateFields.patientNote = data.patient_note;
        }
        
        Object.assign(session, updateFields);
      }
    } else if (session.bookingOption === BookingOption.DOCTOR) {
      // VERSION 4.4: Option 2 (doctor-first) - SEPARATED INTO 5 STEPS
      // Step 1 (initial): doctor_id + clinic_id already set
      // Step 2: Add appointment_date + clinic_shift_hour_id (select schedule)
      // Step 3: Add service_ids (select services)
      // Step 4: Add payment_method (select payment)
      // Step 5: Add patient_note (optional)
      if (updateDto.step === 2) {
        const data = updateDto.data as any;
        
        // Validate required fields for Step 2
        if (!data.appointment_date) {
          throw new BadRequestException('Appointment date is required in step 2');
        }
        if (!data.clinic_shift_hour_id) {
          throw new BadRequestException('Clinic shift hour ID is required in step 2');
        }
        
        // MERGE: Explicitly preserve all existing fields
        const updateFields: any = {
          appointmentDate: data.appointment_date,
          clinicShiftHourId: data.clinic_shift_hour_id,
          currentStep: 2,
        };
        
        // ADDED VERSION 4.0: Save appointment hour
        if (data.appointment_hour) {
          updateFields.appointmentHour = data.appointment_hour;
        }
        
        // MISSING Object.assign FIXXED:
        Object.assign(session, updateFields);
      } else if (updateDto.step === 3) {
        const data = updateDto.data as any;
        
        // V5.0: Accept service_ids (multi-service array) instead of single ID
        if (!data.service_ids || !Array.isArray(data.service_ids) || data.service_ids.length === 0) {
          throw new BadRequestException('service_ids (array) is required in step 3');
        }
        
        // MERGE: Explicitly preserve all existing fields
        Object.assign(session, {
          serviceIds: data.service_ids,
          currentStep: 3,
        });
      } else if (updateDto.step === 4) {
        const data = updateDto.data as any;
        
        // Payment method is REQUIRED in step 4
        if (!data.payment_method) {
          throw new BadRequestException('Payment method is required in step 4');
        }
        
        // MERGE: Explicitly preserve all existing fields
        Object.assign(session, {
          paymentMethod: data.payment_method,
          currentStep: 4,
        });
      } else if (updateDto.step === 5) {
        const data = updateDto.data as any;
        
        // Patient note is optional in step 5
        const updateFields: any = {
          currentStep: 5,
        };
        
        if (data.patient_note !== undefined) {
          updateFields.patientNote = data.patient_note;
        }
        
        // MERGE: Explicitly preserve all existing fields
        Object.assign(session, updateFields);
      }
    } else if (session.bookingOption === BookingOption.SERVICE) {
      // VERSION 4.3: Option 1 (service-first) flow (remains 4 steps)
      // Step 2: COMBINE appointment_date + clinic_shift_hour_id + doctor_id
      // Step 3: Add payment_method (REQUIRED)
      // Step 4: Add patient_note (OPTIONAL)
      if (updateDto.step === 2) {
        const data = updateDto.data as any;
        
        // Validate required fields for Step 2
        if (!data.appointment_date) {
          throw new BadRequestException('Appointment date is required in step 2');
        }
        if (!data.clinic_shift_hour_id) {
          throw new BadRequestException('Clinic shift hour ID is required in step 2');
        }
        
        // MERGE: Explicitly preserve all existing fields
        const updateFields: any = {
          appointmentDate: data.appointment_date,
          clinicShiftHourId: data.clinic_shift_hour_id,
          currentStep: 2,
        };
        
        // ADDED VERSION 4.0: Save appointment hour
        if (data.appointment_hour) {
          updateFields.appointmentHour = data.appointment_hour;
        }
        
        // For service-first flow (Option 1): doctor_id is provided
        if (data.doctor_id) {
          updateFields.doctorId = data.doctor_id;
        }
        
        Object.assign(session, updateFields);
      } else if (updateDto.step === 3) {
        const data = updateDto.data as any;
        
        // Payment method is REQUIRED in step 3
        if (!data.payment_method) {
          throw new BadRequestException('Payment method is required in step 3');
        }
        
        // MERGE: Explicitly preserve all existing fields
        Object.assign(session, {
          paymentMethod: data.payment_method,
          currentStep: 3,
        });
      } else if (updateDto.step === 4) {
        // Step 4: Add patient_note (OPTIONAL)
        const data = updateDto.data as any;
        
        // Patient note is optional - can be empty string or any text
        const updateFields: any = {
          currentStep: 4,
        };
        
        if (data.patient_note !== undefined) {
          updateFields.patientNote = data.patient_note;
        }
        
        // MERGE: Explicitly preserve all existing fields
        Object.assign(session, updateFields);
      }
    } else if (session.bookingOption === BookingOption.OUT_OF_HOURS) {
      // VERSION 4.7: Option 4 (out-of-hours) flow
      // Step 1 (initial): optional clinic_id
      // Step 2: Add appointment_date + extra_hour + doctor_id
      // Step 3: Add service_ids (select services - V5.0 multi-service)
      // Step 4: Add payment_method (select payment)
      // Step 5: Add patient_note (optional)
      if (updateDto.step === 2) {
        const data = updateDto.data as any;
        
        // Validate extra_hour is required
        if (!data.extra_hour) {
          throw new BadRequestException('Extra hour is required in step 2 for out-of-hours booking');
        }
        
        // Convert extra_hour to Date and validate format
        const extraHourDate = new Date(data.extra_hour);
        if (isNaN(extraHourDate.getTime())) {
          throw new BadRequestException('Invalid extra hour format. Must be a valid ISO 8601 timestamp');
        }
        
        // Validate extra_hour must be in the future (use Vietnam timezone)
        if (isInPast(extraHourDate)) {
          throw new BadRequestException('Extra hour must be in the future');
        }
        
        // Validate appointment_date is required
        if (!data.appointment_date) {
          throw new BadRequestException('Appointment date is required in step 2 for out-of-hours booking');
        }
        
        // Validate appointment_date matches the date part of extra_hour
        const appointmentDate = new Date(data.appointment_date);
        const extraHourDateOnly = new Date(extraHourDate.getFullYear(), extraHourDate.getMonth(), extraHourDate.getDate());
        const appointmentDateOnly = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());
        
        if (extraHourDateOnly.getTime() !== appointmentDateOnly.getTime()) {
          throw new BadRequestException('Appointment date must match the date part of extra hour');
        }
        
        // MERGE: Explicitly preserve all existing fields
        // SPECIAL: Hardcode clinicShiftHourId = null for out-of-hours
        const updateFields: any = {
          appointmentDate: data.appointment_date,
          extraHour: data.extra_hour,
          clinicShiftHourId: null,
          currentStep: 2,
        };
        
        // Extract doctor_id for out-of-hours (REQUIRED)
        if (data.doctor_id) {
          updateFields.doctorId = data.doctor_id;
        }
        
        Object.assign(session, updateFields);
      } else if (updateDto.step === 3) {
        const data = updateDto.data as any;
        
        // V5.0: Accept service_ids (multi-service array) for out-of-hours
        if (!data.service_ids || !Array.isArray(data.service_ids) || data.service_ids.length === 0) {
          throw new BadRequestException('service_ids (array) is required in step 3 for out-of-hours booking');
        }
        
        // MERGE: Explicitly preserve all existing fields
        Object.assign(session, {
          serviceIds: data.service_ids,
          currentStep: 3,
        });
      } else if (updateDto.step === 4) {
        const data = updateDto.data as any;
        
        // Payment method is REQUIRED in step 4 for out-of-hours
        if (!data.payment_method) {
          throw new BadRequestException('Payment method is required in step 4 for out-of-hours booking');
        }
        
        // MERGE: Explicitly preserve all existing fields
        Object.assign(session, {
          paymentMethod: data.payment_method,
          currentStep: 4,
        });
      } else if (updateDto.step === 5) {
        const data = updateDto.data as any;
        
        // Patient note is optional in step 5 for out-of-hours
        const updateFields: any = {
          currentStep: 5,
        };
        
        if (data.patient_note !== undefined) {
          updateFields.patientNote = data.patient_note;
        }
        
        // MERGE: Explicitly preserve all existing fields
        Object.assign(session, updateFields);
      }
    }

    // Save updated session to Redis (keep original TTL)
    const key = this.getSessionKey(sessionId);
    const ttl = await this.redisClient.ttl(key);
    await this.redisClient.setex(key, ttl > 0 ? ttl : this.SESSION_TTL, JSON.stringify(session));

    return this.buildSessionResponse(session);
  }

  /**
   * Retrieve a session by ID
   *
   * @param sessionId - Session UUID
   * @returns Booking session object
   * @throws NotFoundException if session not found or expired
   */
  async getSession(sessionId: string): Promise<BookingSession> {
    const key = this.getSessionKey(sessionId);
    const data = await this.redisClient.get(key);

    if (!data) {
      throw new NotFoundException('Booking session not found or expired. Please start a new booking.');
    }

    return JSON.parse(data);
  }

  /**
   * Delete a session from Redis
   *
   * Used after successfully creating an appointment to cleanup
   *
   * @param sessionId - Session UUID
   */
  async deleteSession(sessionId: string): Promise<void> {
    const key = this.getSessionKey(sessionId);
    await this.redisClient.del(key);
  }

  /**
   * Validate initial data based on booking option
   *
   * @param option - Booking option type
   * @param data - Initial data object
   * @throws BadRequestException if validation fails
   */
  private async validateInitialData(
    option: BookingOption,
    data: ServiceInitialDataDto | DoctorInitialDataDto | DateInitialDataDto | OutOfHoursInitialDataDto,
  ): Promise<void> {
    if (option === BookingOption.SERVICE) {
      const serviceData = data as ServiceInitialDataDto;
      
      // Verify service_ids is a valid array (prevent TypeError: parameterValue.value is not iterable)
      if (!serviceData.service_ids || !Array.isArray(serviceData.service_ids) || serviceData.service_ids.length === 0) {
        throw new BadRequestException('service_ids must be a non-empty array');
      }

      // Verify all clinic service configs exist and are active (V5.0 - Multi-Service)
      const serviceConfigs = await this.dataSource.getRepository(ClinicServiceConfig).find({
        where: { 
          _id: In(serviceData.service_ids),
          clinicId: serviceData.clinic_id,
        },
        relations: ['service'],
      });

      if (serviceConfigs.length !== serviceData.service_ids.length) {
        throw new BadRequestException('One or more clinic service configurations not found');
      }

      const inactiveServices = serviceConfigs.filter(sc => !sc.isActive);
      if (inactiveServices.length > 0) {
        throw new BadRequestException('One or more services are currently not available');
      }

      // Verify clinic exists and is active (can be CLINIC_ADMIN or CLINIC_MANAGER)
      const clinic = await this.dataSource.getRepository(Account).findOne({
        where: [
          { _id: serviceData.clinic_id, role: AccountRole.CLINIC_ADMIN },
          { _id: serviceData.clinic_id, role: AccountRole.CLINIC_MANAGER },
        ],
      });

      if (!clinic || clinic.status !== 'ACTIVE') {
        throw new BadRequestException('Clinic not found or inactive');
      }
    } else if (option === BookingOption.DOCTOR) {
      const doctorData = data as DoctorInitialDataDto;
      
      // Verify doctor exists and is active
      const doctor = await this.dataSource.getRepository(Account).findOne({
        where: { _id: doctorData.doctor_id, role: AccountRole.DOCTOR },
      });

      if (!doctor || doctor.status !== 'ACTIVE') {
        throw new BadRequestException('Doctor not found or inactive');
      }

      // If clinic_id provided, verify it exists (can be CLINIC_ADMIN or CLINIC_MANAGER)
      if (doctorData.clinic_id) {
        const clinic = await this.dataSource.getRepository(Account).findOne({
          where: [
            { _id: doctorData.clinic_id, role: AccountRole.CLINIC_ADMIN },
            { _id: doctorData.clinic_id, role: AccountRole.CLINIC_MANAGER },
          ],
        });

        if (!clinic || clinic.status !== 'ACTIVE') {
          throw new BadRequestException('Clinic not found or inactive');
        }
      }
    } else if (option === BookingOption.DATE) {
      const dateData = data as DateInitialDataDto;
      
      // Validate date is in future (at least today) - use Vietnam timezone
      const appointmentDate = new Date(dateData.appointment_date);
      const todayStart = startOfDay();

      if (appointmentDate < todayStart) {
        throw new BadRequestException('Appointment date must be today or in the future');
      }

      // Validate date is within 60 days
      const maxDate = addToVietnamTime(60, 'day');

      if (appointmentDate > maxDate) {
        throw new BadRequestException('Appointment date cannot be more than 60 days in the future');
      }
    } else if (option === BookingOption.OUT_OF_HOURS) {
      const outOfHoursData = data as OutOfHoursInitialDataDto;
      
      // If clinic_id provided, verify it exists and is active
      if (outOfHoursData.clinic_id) {
        const clinic = await this.dataSource.getRepository(Account).findOne({
          where: [
            { _id: outOfHoursData.clinic_id, role: AccountRole.CLINIC_ADMIN },
            { _id: outOfHoursData.clinic_id, role: AccountRole.CLINIC_MANAGER },
          ],
        });

        if (!clinic || clinic.status !== 'ACTIVE') {
          throw new BadRequestException('Clinic not found or inactive');
        }
      }
    }
  }

  /**
   * Validate step sequence (VERSION 4.7)
   * 
   * CHANGES:
   * - Option 1 (service-first): Step range is 2-4 (unchanged)
   * - Option 2 (doctor-first): Step range is 2-5 (changed since 4.3)
   * - Option 3 (date-first): Step range is 2-5 (unchanged)
   * - Option 4 (out-of-hours): Step range is 2-5 (added in 4.7)
   * 
   * @param currentStep - Current step number
   * @param nextStep - Next step number
   * @param bookingOption - Booking option type
   * @throws BadRequestException if step sequence is invalid
   */
  private validateStepSequence(currentStep: number, nextStep: number, bookingOption?: BookingOption): void {
    if (nextStep !== currentStep + 1) {
      throw new BadRequestException(
        `Invalid step sequence. Current step: ${currentStep}, expected next step: ${currentStep + 1}`,
      );
    }

    // Different step ranges for different booking options (VERSION 4.7)
    if (bookingOption === BookingOption.DATE || bookingOption === BookingOption.DOCTOR || bookingOption === BookingOption.OUT_OF_HOURS) {
      // Option 2, 3 & 4: Doctor-first, Date-first, or Out-of-hours - up to step 5
      if (nextStep < 2 || nextStep > 5) {
        throw new BadRequestException(
          `Step must be between 2 and 5 for ${bookingOption}-first booking`,
        );
      }
    } else {
      // Option 1: Service-first - step 2-4
      if (nextStep < 2 || nextStep > 4) {
        throw new BadRequestException('Step must be between 2 and 4 for service-first booking');
      }
    }
  }

  /**
   * Build session response DTO
   *
   * @param session - Booking session object
   * @returns Formatted response DTO
   * 
   * FIX: Always return ALL fields (even if undefined/null) so Frontend can see complete state
   */
  private buildSessionResponse(session: BookingSession): BookingSessionResponseDto {
    const bookingData: Record<string, any> = {};

    // FIX v4.5: Always include ALL possible fields to prevent data loss visibility
    // V5.0: clinic_service_config_id replaced by service_ids (array)
    bookingData.clinic_id = session.clinicId ?? null;
    bookingData.doctor_id = session.doctorId ?? null;
    bookingData.service_ids = session.serviceIds ?? null;
    bookingData.appointment_date = session.appointmentDate ?? null;
    bookingData.clinic_shift_hour_id = session.clinicShiftHourId ?? null;
    bookingData.extra_hour = session.extraHour ?? null;
    bookingData.payment_method = session.paymentMethod ?? null;
    bookingData.patient_note = session.patientNote ?? null;

    return {
      session_id: session.sessionId,
      booking_option: session.bookingOption,
      current_step: session.currentStep,
      expires_at: formatToVietnamTime(session.expiresAt),
      booking_data: bookingData,
    };
  }

  /**
   * Get Redis key for session
   *
   * @param sessionId - Session UUID
   * @returns Redis key string
   */
  private getSessionKey(sessionId: string): string {
    return `${this.KEY_PREFIX}${sessionId}`;
  }
}
