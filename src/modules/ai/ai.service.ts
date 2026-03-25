import { Injectable, BadRequestException } from '@nestjs/common';
import { GeminiService } from './services/gemini.service';
import { ChatGptService } from './services/chatgpt.service';
import { AiChatRequestDto } from './dto/ai-chat-request.dto';
import { AiChatResponseDto } from './dto/ai-chat-response.dto';
import { AiProvider } from './enums/ai-provider.enum';
import { AiModel } from './enums/ai-model.enum';
import { AiChatImvFeedbackRequestDto } from './dto/ai-chat-imv-feedback-request.dto';
import { PatientAppointmentRecommendationRequestDto } from './dto/patient-appointment-recommendation-request.dto';
import { FractureDetectionRequestDto } from './dto/fracture-detection-request.dto';
import { HttpService } from '@nestjs/axios';
import FormData from 'form-data';
import { firstValueFrom } from 'rxjs';
import { API } from '../../common/utils/ai-api';
import { getCurrentVietnamTime } from '../../common/utils/date.util';
import { AccountRepository } from '../accounts/repositories/account.repository';

/**
 * AI Service
 *
 * Main service layer for AI operations in the Bonix Backend.
 *
 * Core Responsibilities:
 * - Route requests to appropriate AI provider (Gemini or ChatGPT)
 * - Validate provider and model compatibility
 * - Format responses with metadata
 * - Provide default model selection per provider
 *
 * Supported Providers:
 * - Google Gemini (gemini-pro, gemini-pro-vision)
 * - OpenAI ChatGPT (gpt-3.5-turbo, gpt-4, gpt-4-turbo-preview)
 */
@Injectable()
export class AiService {
  constructor(
    private readonly geminiService: GeminiService,
    private readonly chatGptService: ChatGptService,
    private readonly httpService: HttpService,
    private readonly accountRepository: AccountRepository,
  ) {}

  /**
   * Process chat completion request
   *
   * Routes the request to the appropriate AI provider service based on
   * the specified provider. Validates model compatibility and returns
   * a formatted response with metadata.
   *
   * @param dto - Chat request with messages, provider, and optional parameters
   * @returns Formatted response with AI-generated content and metadata
   * @throws BadRequestException if provider/model combination is invalid
   *
   * @example
   * const response = await this.aiService.chat({
   *   messages: [{ role: 'user', content: 'Hello!' }],
   *   provider: AiProvider.GEMINI,
   *   model: AiModel.GEMINI_PRO
   * });
   */
  async chat(dto: AiChatRequestDto): Promise<AiChatResponseDto> {
    const model = dto.model || this.getDefaultModel(dto.provider);

    this.validateProviderModel(dto.provider, model);

    let content: string;

    switch (dto.provider) {
      case AiProvider.GEMINI:
        content = await this.geminiService.chatCompletion(dto.messages, model);
        break;

      case AiProvider.CHATGPT:
        content = await this.chatGptService.chatCompletion(dto.messages, model);
        break;

      default:
        throw new BadRequestException(
          `Unsupported AI provider: ${dto.provider}`,
        );
    }

    return {
      content,
      provider: dto.provider,
      model,
      timestamp: getCurrentVietnamTime(),
    };
  }

  async chatServiceImprovement(
    dto: AiChatImvFeedbackRequestDto,
  ): Promise<AiChatResponseDto> {
    const model = AiModel.GPT_5_MINI;

    this.validateProviderModel(AiProvider.CHATGPT, model);

    const content = await this.chatGptService.chatCompletionServiceImprovement(
      dto.clinicId,
      model,
      dto.startDate,
      dto.endDate,
    );

    let formatJson: any;
    try {
      formatJson = JSON.parse(content);
    } catch (error) {
      formatJson = {
        error: 'Error during analysis',
        message: 'The AI response could not be parsed as valid JSON',
        rawContent: content,
      };
    }

    return {
      content: formatJson,
      provider: AiProvider.CHATGPT,
      model,
      timestamp: getCurrentVietnamTime(),
    };
  }

  /**
   * Get similar clinics from AI backend
   * @param clinicId The clinic ID to find similar clinics for
   */
  async getSimilarClinics(clinicId: string): Promise<any> {
    try {
      const url = API.AI.RECOMMENDATION_GET_SIMILAR_CLINICS(clinicId);
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data;
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch similar clinics: ${error.message}`,
      );
    }
  }

  /**
   * Get recommended clinics based on patient appointment history
   * @param dto The payload containing clinic IDs and a limit
   */
  async getRecommendationsFromPatientAppointment(
    dto: PatientAppointmentRecommendationRequestDto,
  ): Promise<any> {
    try {
      const url = API.AI.RECOMMENDATION_RECOMMEND_FROM_APPOINTMENT;

      const clinicManagers = await this.accountRepository.findAccountsByIds(
        dto.clinicIds,
      );

      const adminIds = new Set<string>();
      for (const account of clinicManagers) {
        if (account.parentId) {
          adminIds.add(account.parentId);
        }
      }

      const payload = {
        ...dto,
        clinicIds: Array.from(adminIds),
      };

      const response = await firstValueFrom(
        this.httpService.post(url, payload),
      );
      return response.data;
    } catch (error) {
      throw new BadRequestException(
        `Failed to fetch recommendations from appointment: ${error.message}`,
      );
    }
  }

  /**
   * Detect fractures using AI backend
   * @param dto The payload containing base64 image and optional notes
   */
  async detectFracture(dto: FractureDetectionRequestDto): Promise<any> {
    try {
      const url = API.AI.FRACTURE_DETECTION;

      const formData = new FormData();

      const match = dto.imageBase64.match(
        /^data:image\/([a-zA-Z0-9]+);base64,(.+)$/,
      );
      if (!match) {
        throw new BadRequestException(
          'Invalid base64 image format. Expected data URI like data:image/jpeg;base64,...',
        );
      }

      const extension = match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');

      formData.append('file', buffer, {
        filename: `image.${extension}`,
        contentType: `image/${extension}`,
      });

      if (dto.notes) {
        formData.append('notes', String(dto.notes));
      }

      const response = await firstValueFrom(
        this.httpService.post(url, formData, {
          headers: {
            ...formData.getHeaders(),
          },
        }),
      );

      return response.data;
    } catch (error) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error.message;
      throw new BadRequestException(
        `Failed to process fracture detection: ${errorMessage}`,
      );
    }
  }

  /**
   * Get default model for a provider
   *
   * Returns the recommended default model for each AI provider.
   *
   * @param provider - AI provider
   * @returns Default model for the provider
   */
  private getDefaultModel(provider: AiProvider): AiModel {
    switch (provider) {
      case AiProvider.GEMINI:
        return AiModel.GEMINI_3_FLASH;
      case AiProvider.CHATGPT:
        return AiModel.GPT_5_MINI;
      default:
        throw new BadRequestException(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Validate provider and model compatibility
   *
   * Ensures that the specified model is compatible with the selected provider.
   * Throws an error if an incompatible combination is detected.
   *
   * @param provider - AI provider
   * @param model - AI model
   * @throws BadRequestException if provider/model combination is invalid
   */
  private validateProviderModel(provider: AiProvider, model: AiModel): void {
    const geminiModels = [
      AiModel.GEMINI_3_FLASH,
      AiModel.GEMINI_3_PRO,
      AiModel.GEMINI_25_FLASH,
      AiModel.GEMINI_25_PRO,
    ];
    const chatGptModels = [
      AiModel.GPT_5_MINI,
      AiModel.GPT_4,
      AiModel.GPT_4_TURBO,
      AiModel.GPT_o4_MINI,
    ];

    if (provider === AiProvider.GEMINI && !geminiModels.includes(model)) {
      throw new BadRequestException(
        `Model ${model} is not compatible with provider ${provider}. ` +
          `Available models: ${geminiModels.join(', ')}`,
      );
    }

    if (provider === AiProvider.CHATGPT && !chatGptModels.includes(model)) {
      throw new BadRequestException(
        `Model ${model} is not compatible with provider ${provider}. ` +
          `Available models: ${chatGptModels.join(', ')}`,
      );
    }
  }
}
