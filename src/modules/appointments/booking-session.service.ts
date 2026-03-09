import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
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
} from './dto';
import { ClinicServiceConfig } from '../service-configs/entities/clinic-service-config.entity';
import { Account } from '../accounts/entities/accounts.entity';
import { AccountRole } from '../accounts/enums';

/**
 * Booking Session Interface
 *
 * Represents a booking session stored in Redis
 */
export interface BookingSession {
  sessionId: string;
  patientId: string;
  
  // Data accumulated across steps
  clinicServiceConfigId?: string;
  clinicId?: string;
  doctorId?: string;
  appointmentDate?: string; // YYYY-MM-DD
  clinicShiftHourId?: string;
  paymentMethod?: 'cod' | 'online'; // NEW in v4.0 - Required before finalizing
  patientNote?: string;
  
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
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.SESSION_TTL * 1000);

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
      session.clinicServiceConfigId = data.clinic_service_config_id;
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
        Object.assign(session, {
          clinicShiftHourId: data.clinic_shift_hour_id,
          doctorId: data.doctor_id,
          currentStep: 3,
        });
      } else if (updateDto.step === 4) {
        const data = updateDto.data as any;
        
        // VERSION 4.6: Step 4 now handles clinic_service_config_id
        // Validate clinic_service_config_id is required
        if (!data.clinic_service_config_id) {
          throw new BadRequestException('Service config ID is required in step 4');
        }
        
        // MERGE: Explicitly preserve all existing fields
        Object.assign(session, {
          clinicServiceConfigId: data.clinic_service_config_id,
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
      // VERSION 4.4: Option 2 (doctor-first) - TÁCH RỜI THÀNH 5 STEPS
      // Step 1 (initial): doctor_id + clinic_id already set
      // Step 2: Add appointment_date + clinic_shift_hour_id (chọn lịch)
      // Step 3: Add clinic_service_config_id (chọn dịch vụ)
      // Step 4: Add payment_method (chọn thanh toán)
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
        Object.assign(session, {
          appointmentDate: data.appointment_date,
          clinicShiftHourId: data.clinic_shift_hour_id,
          currentStep: 2,
        });
      } else if (updateDto.step === 3) {
        const data = updateDto.data as any;
        
        // Validate clinic_service_config_id is required in step 3
        if (!data.clinic_service_config_id) {
          throw new BadRequestException('Service config ID is required in step 3');
        }
        
        // MERGE: Explicitly preserve all existing fields
        Object.assign(session, {
          clinicServiceConfigId: data.clinic_service_config_id,
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
    } else {
      // VERSION 4.3: Option 1 (service-first) flow (remains 4 steps)
      // Step 2: GỘP appointment_date + clinic_shift_hour_id + doctor_id
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
    data: ServiceInitialDataDto | DoctorInitialDataDto | DateInitialDataDto,
  ): Promise<void> {
    if (option === BookingOption.SERVICE) {
      const serviceData = data as ServiceInitialDataDto;
      
      // Verify clinic service config exists and is active
      const serviceConfig = await this.dataSource.getRepository(ClinicServiceConfig).findOne({
        where: { 
          _id: serviceData.clinic_service_config_id,
          clinicId: serviceData.clinic_id,
        },
        relations: ['service'],
      });

      if (!serviceConfig) {
        throw new BadRequestException('Clinic service configuration not found');
      }

      if (!serviceConfig.isActive) {
        throw new BadRequestException('This service is currently not available');
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
      
      // Validate date is in future (at least today)
      const appointmentDate = new Date(dateData.appointment_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (appointmentDate < today) {
        throw new BadRequestException('Appointment date must be today or in the future');
      }

      // Validate date is within 60 days
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 60);

      if (appointmentDate > maxDate) {
        throw new BadRequestException('Appointment date cannot be more than 60 days in the future');
      }
    }
  }

  /**
   * Validate step sequence (VERSION 4.4)
   * 
   * THAY ĐỔI: 
   * - Option 1 (service-first): Step range là 2-4 (chưa thay đổi)
   * - Option 2 (doctor-first): Step range là 2-5 (mới thay đổi từ 4.3)
   * - Option 3 (date-first): Step range là 2-5 (chưa thay đổi)
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

    // Different step ranges for different booking options (VERSION 4.4)
    if (bookingOption === BookingOption.DATE || bookingOption === BookingOption.DOCTOR) {
      // Option 2 & 3: Doctor-first or Date-first - up to step 5
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
    // If a field is not set yet, it will be undefined (helps Frontend track progress)
    bookingData.clinic_id = session.clinicId ?? null;
    bookingData.doctor_id = session.doctorId ?? null;
    bookingData.clinic_service_config_id = session.clinicServiceConfigId ?? null;
    bookingData.appointment_date = session.appointmentDate ?? null;
    bookingData.clinic_shift_hour_id = session.clinicShiftHourId ?? null;
    bookingData.payment_method = session.paymentMethod ?? null;
    bookingData.patient_note = session.patientNote ?? null;

    return {
      session_id: session.sessionId,
      booking_option: session.bookingOption,
      current_step: session.currentStep,
      expires_at: session.expiresAt,
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
