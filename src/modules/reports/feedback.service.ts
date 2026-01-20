import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { FeedbackRepository } from './repositories';

@Injectable()
export class FeedbackService {
  constructor(private readonly feedbackRepository: FeedbackRepository) {}

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
