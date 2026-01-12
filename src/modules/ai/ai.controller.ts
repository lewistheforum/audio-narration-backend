import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AiChatRequestDto, AiChatResponseDto } from './dto';
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
    console.log('check result: ', clinic);

    return clinic;
  }
}
