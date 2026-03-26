import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import axios from 'axios';
import { DataSource } from 'typeorm';
import { FeedbackRepository } from './repositories';
import { FeedbackType } from './enums';
import { Feedback } from './entities/feedback.entity';
import { AccountRepository } from '../accounts/repositories';
import { AccountRole } from '../accounts/enums';
import { CreateFeedbackClinicDto } from './dto/create-feedback-clinic.dto';
import { CreateFeedbackDoctorDto } from './dto/create-feedback-doctor.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { DoctorFeedbacksQueryDto } from './dto/doctor-feedbacks-query.dto';
import {
  DoctorFeedbacksResponseDto,
  DoctorFeedbackItemDto,
  FeedbackPatientInfoDto,
  FeedbackAppointmentInfoDto,
} from './dto/doctor-feedbacks-response.dto';
import { API } from '../../common/utils/ai-api';
import { MESSAGES } from '../../common/message';
import { getVietnamTimestamp } from '../../common/utils/date.util';

/**
 * Feedback Service
 *
 * Handles feedback-related business logic including:
 * - Creating feedback for clinics and doctors
 * - Bad word detection using AI API
 * - Labeling feedback descriptions and images using AI
 * - Updating feedback within time limit
 */
@Injectable()
export class FeedbackService {
  constructor(
    private readonly feedbackRepository: FeedbackRepository,
    private readonly accountRepository: AccountRepository,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create Feedback for Clinic
   *
   * Creates a feedback entry for a clinic with bad word detection and AI labeling.
   *
   * Flow:
   * 1. Check for bad words in description using AI API
   * 2. If toxic, return detection result
   * 3. If not toxic, label description and images, then save
   *
   * @param dto - CreateFeedbackClinicDto with clinic feedback data
   * @returns Feedback entity or bad word detection result
   * @throws BadRequestException if toxic content detected
   */
  async createFeedbackForClinic(
    dto: CreateFeedbackClinicDto,
  ): Promise<Feedback | { is_toxic: true; detection: any }> {
    // Step 1: Check for bad words in description
    if (dto.description) {
      const detectionResult = await this.detectBadWords(dto.description);

      if (detectionResult.data.is_toxic) {
        return {
          is_toxic: true,
          detection: detectionResult.data,
        };
      }
    }

    // Step 2: Create and save feedback entity immediately
    const feedback = this.feedbackRepository.createFeedback({
      appointmentId: dto.appointmentId,
      clinicId: dto.clinicId,
      rating: dto.rating,
      description: dto.description,
      feedbackImages: dto.feedbackImages,
      type: FeedbackType.CLINIC,
    });

    const savedFeedback = await this.feedbackRepository.saveFeedback(feedback);

    // Step 3: Run labeling in background (fire and forget)
    this.runBackgroundLabeling(savedFeedback);

    // Step 4: Return immediate result
    return savedFeedback;
  }

  /**
   * Create Feedback for Doctor
   *
   * Creates a feedback entry for a doctor with bad word detection and AI labeling.
   * Requires both clinicId and doctorId.
   *
   * Flow:
   * 1. Check for bad words in description using AI API
   * 2. If toxic, return detection result
   * 3. If not toxic, label description and images, then save
   *
   * @param dto - CreateFeedbackDoctorDto with doctor feedback data
   * @returns Feedback entity or bad word detection result
   * @throws BadRequestException if toxic content detected
   */
  async createFeedbackForDoctor(
    dto: CreateFeedbackDoctorDto,
  ): Promise<Feedback | { is_toxic: true; detection: any }> {
    // Step 1: Check for bad words in description
    if (dto.description) {
      const detectionResult = await this.detectBadWords(dto.description);
      if (detectionResult.data.is_toxic) {
        return {
          is_toxic: true,
          detection: detectionResult.data,
        };
      }
    }

    // Step 2: Create and save feedback entity immediately
    const feedback = this.feedbackRepository.createFeedback({
      appointmentId: dto.appointmentId,
      clinicId: dto.clinicId,
      doctorId: dto.doctorId,
      rating: dto.rating,
      description: dto.description,
      feedbackImages: dto.feedbackImages,
      type: FeedbackType.DOCTOR,
    });

    const savedFeedback = await this.feedbackRepository.saveFeedback(feedback);

    // Step 3: Run labeling in background (fire and forget)
    this.runBackgroundLabeling(savedFeedback);

    // Step 4: Return immediate result
    return savedFeedback;
  }

  /**
   * Update Feedback
   *
   * Updates an existing feedback entry.
   * Enforces 3-day time limit for updates.
   * Re-runs bad word detection and AI labeling if description/images change.
   *
   * @param id - Feedback UUID
   * @param dto - UpdateFeedbackDto
   * @returns Updated Feedback or detection result
   * @throws NotFoundException if feedback not found
   * @throws ForbiddenException if update time limit exceeded
   */
  async updateFeedback(
    id: string,
    dto: UpdateFeedbackDto,
  ): Promise<Feedback | { is_toxic: true; detection: any }> {
    const feedback = await this.feedbackRepository.findFeedbackById(id);

    if (!feedback) {
      throw new NotFoundException(`Feedback with ID ${id} not found`);
    }

    // Check 3-day time limit
    const threeDaysInMillis = 3 * 24 * 60 * 60 * 1000;
    const timeDiff = getVietnamTimestamp() - feedback.createdAt.getTime();

    if (timeDiff > threeDaysInMillis) {
      throw new ForbiddenException(
        'Feedback can only be updated within 3 days of creation',
      );
    }

    // Update fields if provided
    if (dto.rating !== undefined) {
      feedback.rating = dto.rating;
    }

    if (dto.feedbackImages !== undefined) {
      feedback.feedbackImages = dto.feedbackImages;
    }

    let descriptionChanged = false;
    if (
      dto.description !== undefined &&
      dto.description !== feedback.description
    ) {
      // Check for bad words if description changed
      if (dto.description) {
        const detectionResult = await this.detectBadWords(dto.description);
        if (detectionResult.data?.is_toxic) {
          return {
            is_toxic: true,
            detection: detectionResult.data,
          };
        }
      }
      feedback.description = dto.description;
      descriptionChanged = true;
    }

    const savedFeedback = await this.feedbackRepository.saveFeedback(feedback);

    // Run background labeling if description or images changed
    if (descriptionChanged || dto.feedbackImages !== undefined) {
      this.runBackgroundLabeling(savedFeedback);
    }

    return savedFeedback;
  }

  /**
   * Run Background Labeling
   *
   * Performs AI labeling for description and images in the background.
   * Updates the feedback entity with results.
   *
   * @param feedback - The saved feedback entity
   */
  private async runBackgroundLabeling(feedback: Feedback) {
    try {
      const descriptionLabelPromise = feedback.description
        ? this.labelDescription(feedback.description)
        : Promise.resolve(null);

      const imagesLabelPromise =
        feedback.feedbackImages && feedback.feedbackImages.length > 0
          ? this.labelImages(feedback.feedbackImages)
          : Promise.resolve(null);


      const [descriptionLabel, feedbackImagesLabel] = await Promise.all([
        descriptionLabelPromise,
        imagesLabelPromise,
      ]);

      let hasUpdates = false;

      if (descriptionLabel) {
        feedback.descriptionLabel = descriptionLabel;
        hasUpdates = true;
      }

      if (feedbackImagesLabel) {
        feedback.feedbackImagesLabel = feedbackImagesLabel;
        hasUpdates = true;
      }

      if (hasUpdates) {
        await this.feedbackRepository.saveFeedback(feedback);
      }
    } catch (error) {
      console.error(
        `Error in background labeling for feedback ${feedback._id}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Detect Bad Words
   *
   * Calls AI API to detect toxic content in text.
   *
   * @param text - Text to check for bad words
   * @returns Detection result from AI API
   */
  private async detectBadWords(text: string): Promise<any> {
    try {
      const response = await axios.post(API.AI.BAD_WORD_DETECTION, {
        detection_type: 'all',
        text: text,
      });

      return response.data;
    } catch (error) {
      console.error('Error detecting bad words:', error.message);
      // If detection service is unavailable, allow feedback to proceed
      return { is_toxic: false };
    }
  }

  /**
   * Label Description
   *
   * Calls AI API to label feedback description text.
   *
   * @param text - Description text to label
   * @returns Array of labels from AI API
   */
  private async labelDescription(text: string): Promise<any> {
    try {
      const response = await axios.post(API.AI.FEEDBACK_LABEL_DESCRIPTION, {
        text: text,
      });

      return (
        response.data.data.results?.map((result: any) => result.label) || []
      );
    } catch (error) {
      console.error('Error labeling description:', error.message);
      return null;
    }
  }

  /**
   * Label Images
   *
   * Calls AI API to label each feedback image.
   *
   * @param imageUrls - Array of image URLs to label
   * @returns Array of image labels from AI API
   */
  private async labelImages(imageUrls: string[]): Promise<any[]> {
    const imageLabels = [];
    for (const imageUrl of imageUrls) {
      try {
        const response = await axios.post(API.AI.FEEDBACK_LABEL_IMAGE, {
          image_url: imageUrl,
        });

        imageLabels.push({
          description: response.data.data.description,
        });
      } catch (error) {
        console.error(`Error labeling image ${imageUrl}:`, error.message);
        imageLabels.push({
          url: imageUrl,
          description: null,
        });
      }
    }
    return imageLabels;
  }

  async labelFeedbacks() {
    const feedbacks = await this.feedbackRepository.findAllFeedbacks();

    for (const feedback of feedbacks) {
      // Label Description
      if (feedback.description) {
        try {
          const response = await axios.post(API.AI.FEEDBACK_LABEL_DESCRIPTION, {
            text: feedback.description,
          });
          if (response.data.data?.results) {
            feedback.descriptionLabel = response.data.data.results.map(
              (result: any) => result.label,
            );
          }
        } catch (error) {
          console.error(
            `Error labeling description for feedback ${feedback._id}:`,
            error.message,
          );
        }
      }

      if (feedback.feedbackImages && Array.isArray(feedback.feedbackImages)) {
        const imageLabels = [];
        for (const imageUrl of feedback.feedbackImages) {
          try {
            const response = await axios.post(API.AI.FEEDBACK_LABEL_IMAGE, {
              image_url: imageUrl,
            });
            if (response.data.data?.description) {
              imageLabels.push({
                description: response.data.data.description,
              });
            }
          } catch (error) {
            console.error(`Error labeling image ${imageUrl}:`, error.message);
          }
        }
        feedback.feedbackImagesLabel = imageLabels;
      }

      await this.feedbackRepository.saveFeedback(feedback);
    }
  }

  async labelFeedbackById(id: string) {
    const feedback = await this.feedbackRepository.findFeedbackById(id);

    if (feedback.description) {
      try {
        const response = await axios.post(API.AI.FEEDBACK_LABEL_DESCRIPTION, {
          text: feedback.description,
        });
        if (response.data.data?.results) {
          feedback.descriptionLabel = response.data.data.results.map(
            (result: any) => result.label,
          );
        }
      } catch (error) {
        console.error(
          `Error labeling description for feedback ${feedback._id}:`,
          error.message,
        );
      }
    }

    if (feedback.feedbackImages && Array.isArray(feedback.feedbackImages)) {
      const imageLabels = [];
      for (const imageUrl of feedback.feedbackImages) {
        try {
          const response = await axios.post(API.AI.FEEDBACK_LABEL_IMAGE, {
            image_url: imageUrl,
          });
          if (response.data.data?.description) {
            imageLabels.push({
              description: response.data.data.description,
            });
          }
        } catch (error) {
          console.error(`Error labeling image ${imageUrl}:`, error.message);
        }
      }
      feedback.feedbackImagesLabel = imageLabels;
    }

    await this.feedbackRepository.saveFeedback(feedback);
    return feedback;
  }

  async findAllFeedbacks() {
    return this.feedbackRepository.findAllFeedbacks();
  }

  async findAllFeedbacksById(id: string) {
    const feedback = await this.feedbackRepository.findFeedbackById(id);
    return feedback ? [feedback] : [];
  }

  async findFeedbacksByDoctorId(doctorId: string) {
    return this.feedbackRepository.findFeedbacksByDoctorId(doctorId);
  }

  /**
   * Get clinic manager list by clinic admin id and all feedback in each clinic manager
   * OPTIMIZED: Uses single LEFT JOIN query instead of N+1 Promise.all
   *
   * @param adminId - Clinic Admin UUID
   */
  async getClinicManagersFeedbacksByAdminId(adminId: string) {
    // Fetch managers with their feedbacks in a single query using LEFT JOIN
    const rawData = await this.dataSource.query(`
      SELECT 
        m._id AS manager_id,
        m.email AS manager_email,
        cmi.full_name AS manager_name,
        cmi.clinic_branch_name AS clinic_branch_name,
        f._id AS feedback_id,
        f.rating,
        f.description,
        f.created_at AS feedback_created_at,
        f.type AS feedback_type
      FROM accounts m
      LEFT JOIN clinic_manager_information cmi ON cmi.account_id = m._id AND cmi.deleted_at IS NULL
      LEFT JOIN feedbacks f ON f.clinic_id = m._id AND f.deleted_at IS NULL
      WHERE m.parent_id = $1
        AND m.role = $2
        AND m.deleted_at IS NULL
      ORDER BY m._id, f.created_at DESC
    `, [adminId, AccountRole.CLINIC_MANAGER]);

    if (!rawData || rawData.length === 0) {
      return [];
    }

    // Group feedbacks by manager in memory
    const managerMap = new Map<string, {
      clinicManagerId: string;
      clinicManagerEmail: string | null;
      clinicManagerName: string;
      clinicBranchName: string;
      feedbacks: Array<{
        feedback_id: string;
        rating: number;
        description: string | null;
        created_at: Date;
        feedback_type: string;
      }>;
    }>();

    for (const row of rawData) {
      if (!managerMap.has(row.manager_id)) {
        managerMap.set(row.manager_id, {
          clinicManagerId: row.manager_id,
          clinicManagerEmail: row.manager_email,
          clinicManagerName: row.manager_name || row.manager_email || 'Unknown',
          clinicBranchName: row.clinic_branch_name || '',
          feedbacks: [],
        });
      }

      // Only add feedback if it exists (LEFT JOIN can return NULL for feedback fields)
      if (row.feedback_id) {
        managerMap.get(row.manager_id)!.feedbacks.push({
          feedback_id: row.feedback_id,
          rating: row.rating,
          description: row.description,
          created_at: row.feedback_created_at,
          feedback_type: row.feedback_type,
        });
      }
    }

    return Array.from(managerMap.values());
  }

  /**
   * Get Doctor Feedbacks
   *
   * Retrieves paginated feedbacks for a specific doctor with patient and appointment info
   *
   * @param doctorId - Doctor UUID
   * @param query - Query parameters (pagination, sorting, filtering)
   * @returns Paginated feedbacks response
   *
   * Business Rules:
   * - Only return feedbacks where type = DOCTOR and doctor_id = doctorId
   * - Include patient information (name, image, gender)
   * - Include appointment information (date, clinic name)
   * - Support pagination, sorting by created_at or rating
   * - Support filtering by minimum rating
   * - Support search in description
   * - Calculate average rating and rating distribution
   */
  async getDoctorFeedbacks(
    doctorId: string,
    query: DoctorFeedbacksQueryDto,
  ): Promise<DoctorFeedbacksResponseDto> {
    const {
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      order = 'DESC',
      min_rating,
      search,
    } = query;

    const skip = (page - 1) * limit;

    // Build WHERE conditions
    let whereConditions = `
      f.doctor_id = $1
      AND f.type = 'DOCTOR'
      AND f.deleted_at IS NULL
    `;
    const queryParams: any[] = [doctorId];
    let paramIndex = 2;

    if (min_rating) {
      whereConditions += ` AND f.rating >= $${paramIndex}`;
      queryParams.push(min_rating);
      paramIndex++;
    }

    if (search) {
      whereConditions += ` AND f.description ILIKE $${paramIndex}`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Build ORDER BY clause
    const orderByClause = sort_by === 'rating' ? 'f.rating' : 'f.created_at';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM feedbacks f
      WHERE ${whereConditions}
    `;
    const countResult = await this.dataSource.query(countQuery, queryParams);
    const total = parseInt(countResult[0]?.total || '0', 10);

    // Get feedbacks with patient and appointment info
    const feedbacksQuery = `
      SELECT 
        f._id as feedback_id,
        f.rating,
        f.description,
        f.description_label,
        f.feedback_images,
        f.feedback_images_label,
        f.created_at,
        
        -- Patient info
        acc._id as patient_id,
        ga.full_name as patient_name,
        ga.profile_picture as patient_image,
        ga.gender as patient_gender,
        
        -- Appointment info
        f.appointment_id,
        apt.appointment_date,
        clinic_ga.full_name as clinic_name
        
      FROM feedbacks f
      LEFT JOIN appointments apt ON apt._id = f.appointment_id
      LEFT JOIN accounts acc ON acc._id = apt.patient_id
      LEFT JOIN general_accounts ga ON ga.account_id = acc._id
      LEFT JOIN accounts clinic_acc ON clinic_acc._id = f.clinic_id
      LEFT JOIN general_accounts clinic_ga ON clinic_ga.account_id = clinic_acc._id
      
      WHERE ${whereConditions}
      ORDER BY ${orderByClause} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, skip);
    const feedbacksData = await this.dataSource.query(
      feedbacksQuery,
      queryParams,
    );

    // Calculate statistics (average rating and distribution)
    const statsQuery = `
      SELECT 
        AVG(f.rating)::NUMERIC(3,2) as avg_rating,
        COUNT(CASE WHEN f.rating = 5 THEN 1 END) as rating_5,
        COUNT(CASE WHEN f.rating = 4 THEN 1 END) as rating_4,
        COUNT(CASE WHEN f.rating = 3 THEN 1 END) as rating_3,
        COUNT(CASE WHEN f.rating = 2 THEN 1 END) as rating_2,
        COUNT(CASE WHEN f.rating = 1 THEN 1 END) as rating_1
      FROM feedbacks f
      WHERE f.doctor_id = $1
        AND f.type = 'DOCTOR'
        AND f.deleted_at IS NULL
    `;
    const statsResult = await this.dataSource.query(statsQuery, [doctorId]);
    const stats = statsResult[0];

    // Map to DTOs
    const feedbacks: DoctorFeedbackItemDto[] = feedbacksData.map((fb: any) => ({
      feedback_id: fb.feedback_id,
      rating: fb.rating,
      description: fb.description || null,
      description_label: fb.description_label || null,
      feedback_images: fb.feedback_images || null,
      feedback_images_label: fb.feedback_images_label || null,
      patient: {
        patient_id: fb.patient_id,
        full_name: fb.patient_name,
        profile_image_url: fb.patient_image || null,
        gender: fb.patient_gender || null,
      } as FeedbackPatientInfoDto,
      appointment: {
        appointment_id: fb.appointment_id,
        appointment_date:
          fb.appointment_date instanceof Date
            ? fb.appointment_date.toISOString().split('T')[0]
            : new Date(fb.appointment_date).toISOString().split('T')[0],
        clinic_name: fb.clinic_name,
      } as FeedbackAppointmentInfoDto,
      created_at: fb.created_at,
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      total,
      page,
      limit,
      total_pages: totalPages,
      average_rating: parseFloat(stats.avg_rating || '0'),
      rating_distribution: {
        '5': parseInt(stats.rating_5 || '0', 10),
        '4': parseInt(stats.rating_4 || '0', 10),
        '3': parseInt(stats.rating_3 || '0', 10),
        '2': parseInt(stats.rating_2 || '0', 10),
        '1': parseInt(stats.rating_1 || '0', 10),
      },
      feedbacks,
    };
  }
}
