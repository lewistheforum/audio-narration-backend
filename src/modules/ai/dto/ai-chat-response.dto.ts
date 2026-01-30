import { ApiProperty } from '@nestjs/swagger';
import { AiProvider } from '../enums/ai-provider.enum';
import { AiModel } from '../enums/ai-model.enum';

/**
 * AI Chat Response DTO
 *
 * Response payload from AI chat completion endpoints.
 * Contains the AI-generated content and metadata about the request.
 */
export class AiChatResponseDto {
  @ApiProperty({
    description: 'AI-generated response content',
    example:
      'Diabetes symptoms include increased thirst, frequent urination...',
  })
  content: string;

  @ApiProperty({
    description: 'AI provider that generated the response',
    enum: AiProvider,
    example: AiProvider.GEMINI,
  })
  provider: AiProvider;

  @ApiProperty({
    description: 'AI model used to generate the response',
    example: 'gemini-pro',
  })
  model: string;

  @ApiProperty({
    description: 'Timestamp when the response was generated',
    example: '2026-01-10T14:18:00.000Z',
  })
  timestamp: Date;
}
