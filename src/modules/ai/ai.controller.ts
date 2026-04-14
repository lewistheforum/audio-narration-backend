import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiService } from './ai.service';
import {
  AiChatRequestDto,
  AiChatResponseDto,
  PatientAppointmentRecommendationRequestDto,
  FractureDetectionRequestDto,
} from './dto';
import { AiChatImvFeedbackRequestDto } from './dto/ai-chat-imv-feedback-request.dto';

/**
 * AI Controller
 *
 * REST API endpoints for AI operations in the Medicare Backend.
 *
 * Endpoints:
 * - POST /ai/chat - Generate AI chat completions
 *
 * Supported AI Providers:
 * - Google Gemini
 * - OpenAI ChatGPT
 */
@ApiTags('AI')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  /**
   * Generate AI chat completion
   *
   * Processes a chat request using the specified AI provider and model.
   * Supports multi-turn conversations via the messages array.
   *
   * @param dto - Chat request with messages, provider, and optional parameters
   * @returns AI-generated response with metadata
   *
   * @example
   * POST /ai/chat
   * {
   *   "messages": [
   *     { "role": "user", "content": "What are the symptoms of diabetes?" }
   *   ],
   *   "provider": "GEMINI",
   *   "model": "gemini-pro",
   * }
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate AI chat completion',
    description:
      'Generate a chat completion using Google Gemini or OpenAI ChatGPT. ' +
      'Supports conversation history and configurable parameters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat completion generated successfully',
    type: AiChatResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters or provider/model mismatch',
  })
  @ApiResponse({
    status: 500,
    description: 'AI API error or internal server error',
  })
  async chat(@Body() dto: AiChatRequestDto): Promise<AiChatResponseDto> {
    return this.aiService.chat(dto);
  }

  @Post('chat-service-improvement')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate AI chat completion',
    description:
      'Generate a chat completion using Google Gemini or OpenAI ChatGPT. ' +
      'Supports conversation history and configurable parameters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Chat completion generated successfully',
    type: AiChatResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters or provider/model mismatch',
  })
  @ApiResponse({
    status: 500,
    description: 'AI API error or internal server error',
  })
  async chatServiceImprovement(
    @Body() dto: AiChatImvFeedbackRequestDto,
  ): Promise<AiChatResponseDto> {
    const clinic = await this.aiService.chatServiceImprovement(dto);

    return clinic;
  }

  @Get('recommendation-clinic/clinics/:id/similar')
  @ApiOperation({
    summary: 'Get similar clinics',
    description:
      'Fetch similar clinics from the AI backend based on the clinic ID.',
  })
  @ApiResponse({
    status: 200,
    description: 'Similar clinics retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to fetch similar clinics',
  })
  async getSimilarClinics(@Param('id') id: string): Promise<any> {
    return this.aiService.getSimilarClinics(id);
  }

  @Post('recommendation-clinic/clinics/recommend/patient-appointment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get recommended clinics from patient appointment history',
    description:
      'Fetch recommended clinics from the AI backend based on a list of clinic IDs from previous appointments.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommended clinics retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to fetch recommendations',
  })
  async getRecommendationsFromPatientAppointment(
    @Body() dto: PatientAppointmentRecommendationRequestDto,
  ): Promise<any> {
    return this.aiService.getRecommendationsFromPatientAppointment(dto);
  }

  @Get('recommendation-clinic/clinics/:id/clinic-address')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get recommended clinics from patient address',
    description:
      "Fetch recommended clinics (Admins and Managers) from the database matching the patient's province code.",
  })
  @ApiResponse({
    status: 200,
    description: 'Recommended clinics retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to fetch recommendations',
  })
  async getRecommendationsFromPatientAddress(
    @Param('id') id: string,
  ): Promise<any> {
    return this.aiService.getRecommendationsFromPatientAddress(id);
  }

  @Get('recommendation-clinic/clinics/most-rating')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get most rating clinics',
    description:
      'Fetch most rating clinics (Admins and Managers) from the database.',
  })
  @ApiResponse({
    status: 200,
    description: 'Most rating clinics retrieved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to fetch recommendations',
  })
  async getMostRatingClinics(): Promise<any> {
    return this.aiService.getMostRatingClinics();
  }

  @Post('fracture-detection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detect fractures in X-ray image',
    description:
      'Upload a base64 encoded X-ray image and optional patient notes ' +
      'to detect fractures using AI.',
  })
  @ApiResponse({
    status: 200,
    description: 'Fracture detection completed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid base64 image or bad request',
  })
  async detectFracture(@Body() dto: FractureDetectionRequestDto): Promise<any> {
    return this.aiService.detectFracture(dto);
  }
}
