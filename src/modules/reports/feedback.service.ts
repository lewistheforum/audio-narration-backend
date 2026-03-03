import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import axios from 'axios';
import { FeedbackRepository } from './repositories';
import { FeedbackType } from './enums';
import { Feedback } from './entities/feedback.entity';
import { CreateFeedbackClinicDto } from './dto/create-feedback-clinic.dto';
import { CreateFeedbackDoctorDto } from './dto/create-feedback-doctor.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { API } from '../../common/utils/ai-api';
import { MESSAGES } from '../../common/message';

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
  constructor(private readonly feedbackRepository: FeedbackRepository) { }

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
      if (detectionResult.is_toxic) {
        return {
          is_toxic: true,
          detection: detectionResult,
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
    const timeDiff = Date.now() - feedback.createdAt.getTime();

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
          // url: imageUrl,
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
    return this.feedbackRepository.findFeedbacksByClinicId(id);
  }

  async findFeedbacksByDoctorId(doctorId: string) {
    return this.feedbackRepository.findFeedbacksByDoctorId(doctorId);
  }
}
