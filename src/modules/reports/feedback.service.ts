import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { FeedbackRepository } from './repositories';
import { FeedbackType } from './enums';
import { Feedback } from './entities/feedback.entity';
import { CreateFeedbackClinicDto } from './dto/create-feedback-clinic.dto';
import { CreateFeedbackDoctorDto } from './dto/create-feedback-doctor.dto';
import { API } from '../../common/utils/ai-api';
import { MESSAGES } from '../../common/message';

/**
 * Feedback Service
 *
 * Handles feedback-related business logic including:
 * - Creating feedback for clinics and doctors
 * - Bad word detection using AI API
 * - Labeling feedback descriptions and images using AI
 */
@Injectable()
export class FeedbackService {
  constructor(private readonly feedbackRepository: FeedbackRepository) {}

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
      if (detectionResult.is_toxic) {
        return {
          is_toxic: true,
          detection: detectionResult,
        };
      }
    }

    // Step 2: Create feedback entity
    const feedback = this.feedbackRepository.createFeedback({
      appointmentId: dto.appointmentId,
      clinicId: dto.clinicId,
      rating: dto.rating,
      description: dto.description,
      feedbackImages: dto.feedbackImages,
      type: FeedbackType.CLINIC,
    });

    // Step 3: Label description if exists
    if (dto.description) {
      feedback.descriptionLabel = await this.labelDescription(dto.description);
    }

    // Step 4: Label images if exist
    if (dto.feedbackImages && dto.feedbackImages.length > 0) {
      feedback.feedbackImagesLabel = await this.labelImages(dto.feedbackImages);
    }

    // Step 5: Save and return
    return this.feedbackRepository.saveFeedback(feedback);
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

    // Step 2: Create feedback entity
    const feedback = this.feedbackRepository.createFeedback({
      appointmentId: dto.appointmentId,
      clinicId: dto.clinicId,
      doctorId: dto.doctorId,
      rating: dto.rating,
      description: dto.description,
      feedbackImages: dto.feedbackImages,
      type: FeedbackType.DOCTOR,
    });

    // Step 3: Label description if exists
    if (dto.description) {
      feedback.descriptionLabel = await this.labelDescription(dto.description);
    }

    // Step 4: Label images if exist
    if (dto.feedbackImages && dto.feedbackImages.length > 0) {
      feedback.feedbackImagesLabel = await this.labelImages(dto.feedbackImages);
    }

    // Step 5: Save and return
    return this.feedbackRepository.saveFeedback(feedback);
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
      return response.data.results?.map((result: any) => result.label) || [];
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
          url: imageUrl,
          description: response.data.description,
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
          const response = await axios.post(
            'http://localhost:8080/api/v1/feedback/label-description',
            { text: feedback.description },
          );
          feedback.descriptionLabel = response.data.results.map(
            (result: any) => result.label,
          );
        } catch (error) {
          console.error(
            `Error labeling description for feedback ${feedback._id}:`,
            error.message,
          );
        }
      }

      // Label Images
      if (feedback.feedbackImages && Array.isArray(feedback.feedbackImages)) {
        const imageLabels = [];
        for (const imageUrl of feedback.feedbackImages) {
          try {
            const response = await axios.post(
              'http://localhost:8080/api/v1/feedback/label-image',
              { image_url: imageUrl },
            );
            imageLabels.push({
              description: response.data.description,
            });
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

    // Label Description
    if (feedback.description) {
      try {
        const response = await axios.post(
          'http://localhost:8080/api/v1/feedback/label-description',
          { text: feedback.description },
        );
        feedback.descriptionLabel = response.data.results.map(
          (result: any) => result.label,
        );
      } catch (error) {
        console.error(
          `Error labeling description for feedback ${feedback._id}:`,
          error.message,
        );
      }
    }

    // Label Images
    if (feedback.feedbackImages && Array.isArray(feedback.feedbackImages)) {
      const imageLabels = [];
      for (const imageUrl of feedback.feedbackImages) {
        try {
          const response = await axios.post(
            'http://localhost:8080/api/v1/feedback/label-image',
            { image_url: imageUrl },
          );
          imageLabels.push({
            description: response.data.description,
          });
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
}
