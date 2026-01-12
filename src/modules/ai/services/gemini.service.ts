import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { ChatMessageDto } from '../dto/chat-message.dto';
import { AiModel } from '../enums/ai-model.enum';
import { FeedbackRepository } from 'src/modules/reports/repositories';

/**
 * Gemini Service
 *
 * Service for integrating with Google's Gemini AI API.
 *
 * Features:
 * - Chat completion with Gemini Pro models
 * - Conversation history support
 * - Configurable temperature and token limits
 * - Comprehensive error handling
 *
 * API Documentation: https://ai.google.dev/docs
 */
@Injectable()
export class GeminiService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(
    private readonly configService: ConfigService,
    private readonly feedbackRepository: FeedbackRepository,
  ) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!this.apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not configured in environment variables',
      );
    }
  }

  /**
   * Generate chat completion using Gemini API
   *
   * Converts messages to Gemini's format and sends a request to the API.
   * Handles conversation history by combining all messages into a single prompt.
   *
   * @param messages - Array of chat messages forming the conversation
   * @param model - Gemini model to use (defaults to gemini-pro)
   * @param temperature - Controls randomness (0.0-1.0)
   * @param maxTokens - Maximum tokens in response
   * @returns AI-generated response content
   * @throws BadRequestException if request validation fails
   * @throws InternalServerErrorException if API call fails
   */
  async chatCompletion(
    messages: ChatMessageDto[],
    model: AiModel = AiModel.GEMINI_3_FLASH,
    temperature?: number,
    maxTokens?: number,
  ): Promise<string> {
    try {
      // Convert messages to Gemini format
      const prompt = this.formatMessagesForGemini(messages);

      // Build request URL
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

      // Build request payload
      const payload: any = {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {},
      };

      // Add optional parameters
      if (temperature !== undefined) {
        payload.generationConfig.temperature = temperature;
      }

      if (maxTokens !== undefined) {
        payload.generationConfig.maxOutputTokens = maxTokens;
      }

      // Make API request
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Extract response content
      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new InternalServerErrorException(
          'Invalid response format from Gemini API',
        );
      }

      return content;
    } catch (error) {
      this.handleError(error);
    }
  }

  async chatCompletionServiceImprovement(
    clinicId: string,
    model: AiModel = AiModel.GEMINI_3_FLASH,
    temperature?: number,
    maxTokens?: number,
  ): Promise<string> {
    try {
      if (!clinicId) {
        throw new BadRequestException('Clinic ID is required');
      }
      const clinicFeedbacks =
        await this.feedbackRepository.findFeedbacksByClinicId(clinicId);

      const prompt = `You are a Data Analyst and Operational Strategy Consultant for medical clinics (especially orthopedic clinics). Your task is to analyze customer feedback data to identify operational blind spots and propose solutions to improve customer satisfaction (CSAT). I have a JSON dataset containing customer feedback about an orthopedic clinic. The data includes: rating: Rating (1-5 stars). description: Detailed customer description. descriptionLabel: Pre-processed labels classifying aspects and sentiments (e.g., STAFF:Negative, DR_SKILL:Positive). feedbackImagesLabel: Text descriptions of customer-attached images (description of facilities, equipment, etc.). JSON Data: ${JSON.stringify(
        clinicFeedbacks,
      )} Perform an in-depth analysis following these steps: Part 1: Overview Calculate the percentage of positive/negative/neutral sentiment for each key aspect: STAFF (Receptionist/Front Desk), DR_SKILL (Doctor), DR_ATTITUDE (Doctor's Attitude), COST (Cost), WAIT_TIME (Waiting Time), FACILITY (Facilities), PROCEDURE (Procedure). Identify the clinic's strongest selling proposition (USP) and weakest pain point based on their frequency of appearance in the description label. Part 2: Deep Dive Analysis & Correlation Doctor-Staff Paradox: Analyze the discrepancy between the ratings of doctors (DR_SKILL, DR_ATTITUDE) and staff/receptionists (STAFF). Is it possible for a doctor to be highly skilled but still receive 2-3 stars due to poor receptionist service? Cost Analysis: Specifically analyze complaints about COST. Are customers complaining about high prices or a lack of transparency? Image Analysis: Based on feedbackImagesLabel (e.g., photos of modern operating rooms, clean hospital beds...), compare them with ratings. Can good facilities salvage a poor service experience? Part 3: Actionable Insights: Provide 5 specific solutions, prioritized (Urgent/Long-term), to improve service. For each solution, clearly state: Problem to be solved: (Based on data). Specific action: (e.g., Change the quotation process, Retrain receptionist communication scripts...). Measurement KPI: How will the solution be effective? After completion, please format the output as JSON as follows: { overview : { sentiment_analysis : { staff : { positive : <double>, negative : <double>, neutral : <double> }, dr_skill : { positive : <double>, negative : <double>, neutral : <double> }, dr_attitude : { positive : <double>, negative : <double>, neutral : <double> }, cost : { positive : <double>, negative : <double>, neutral : <double> }, wait_time : { positive : <double>, negative : <double>, neutral : <double> }, facility : { positive : <double>, negative : <double>, neutral : <double> }, procedure : { positive : <double>, negative : <double>, neutral : <double> } }, strong : <string> (strengths), weak : <string> (weakness) }, deep_dive : { doctor_staff : <string>, cost : <string>, image : Array <string> }, action_insights : [ { priority : URGENT | MEDIUM | LONG <enum>, problem : <string>, action : <string>, evaluate : <string> }, ] } Note: Only provide the final output in JSON format; do not include any other information. Be aware that the JSON must follow the format specified above; no other data fields can be entered in that format.`;

      // Build request URL
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

      // Build request payload
      const payload: any = {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {},
      };

      // Add optional parameters
      if (temperature !== undefined) {
        payload.generationConfig.temperature = temperature;
      }

      if (maxTokens !== undefined) {
        payload.generationConfig.maxOutputTokens = maxTokens;
      }

      // Make API request
      const response = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Extract response content
      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!content) {
        throw new InternalServerErrorException(
          'Invalid response format from Gemini API',
        );
      }

      return content;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Format messages for Gemini API
   *
   * Gemini expects a single prompt string, so we combine all messages
   * into a formatted conversation string.
   *
   * @param messages - Array of chat messages
   * @returns Formatted prompt string
   */
  private formatMessagesForGemini(messages: ChatMessageDto[]): string {
    return messages
      .map((msg) => {
        const roleLabel = msg.role.toUpperCase();
        return `${roleLabel}: ${msg.content}`;
      })
      .join('\n\n');
  }

  /**
   * Handle API errors
   *
   * Converts Gemini API errors into appropriate NestJS exceptions
   * with user-friendly error messages.
   *
   * @param error - Error from API call
   * @throws BadRequestException or InternalServerErrorException
   */
  private handleError(error: any): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.response) {
        const status = axiosError.response.status;
        const data: any = axiosError.response.data;

        if (status === 400) {
          throw new BadRequestException(
            data?.error?.message || 'Invalid request to Gemini API',
          );
        }

        if (status === 401 || status === 403) {
          throw new InternalServerErrorException(
            'Gemini API authentication failed. Check API key configuration.',
          );
        }

        if (status === 429) {
          throw new InternalServerErrorException(
            'Gemini API rate limit exceeded. Please try again later.',
          );
        }
      }

      throw new InternalServerErrorException(
        `Gemini API request failed: ${axiosError.message}`,
      );
    }

    throw new InternalServerErrorException(
      'An unexpected error occurred while calling Gemini API',
    );
  }
}
