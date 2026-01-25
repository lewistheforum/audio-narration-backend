import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  ValidateNested,
  ArrayMinSize,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AiProvider } from '../enums/ai-provider.enum';
import { AiModel } from '../enums/ai-model.enum';
import { ChatMessageDto } from './chat-message.dto';

/**
 * AI Chat Request DTO
 *
 * Request payload for AI chat completion endpoints.
 * Supports both Gemini and ChatGPT providers with configurable parameters.
 *
 * Features:
 * - Multi-turn conversations via messages array
 * - Provider and model selection
 * - Temperature control for response randomness
 * - Max tokens limit for response length
 */
export class AiChatImvFeedbackRequestDto {
  // @ApiProperty({
  //   description: 'Array of chat messages forming the conversation',
  //   type: [ChatMessageDto],
  //   example: [{ role: 'user', content: 'What are the symptoms of diabetes?' }],
  // })
  // @IsNotEmpty({ message: 'Messages are required' })
  // @IsArray({ message: 'Messages must be an array' })
  // @ArrayMinSize(1, { message: 'At least one message is required' })
  // @ValidateNested({ each: true })
  // @Type(() => ChatMessageDto)
  // messages: ChatMessageDto[];

  @ApiProperty({
    description: 'AI provider to use',
    enum: AiProvider,
    example: AiProvider.GEMINI,
  })
  @IsNotEmpty({ message: 'Provider is required' })
  @IsEnum(AiProvider, { message: 'Invalid AI provider' })
  provider: AiProvider;

  @ApiProperty({
    description: 'Clinic ID to use',
    example: '123456789',
  })
  @IsNotEmpty({ message: 'Clinic ID is required' })
  @IsString({ message: 'Clinic ID must be a string' })
  clinicId: string;

  @ApiProperty({
    description: 'AI model to use',
    enum: AiModel,
    example: AiModel.GEMINI_3_FLASH,
    required: false,
  })
  @IsOptional()
  @IsEnum(AiModel, { message: 'Invalid AI model' })
  model?: AiModel;

  // @ApiProperty({
  //   description:
  //     'Temperature controls randomness (0.0 = deterministic, 1.0 = creative)',
  //   example: 0.7,
  //   required: false,
  //   minimum: 0,
  //   maximum: 1,
  // })
  // @IsOptional()
  // @IsNumber({}, { message: 'Temperature must be a number' })
  // @Min(0, { message: 'Temperature must be at least 0' })
  // @Max(1, { message: 'Temperature must be at most 1' })
  // temperature?: number;

  // @ApiProperty({
  //   description: 'Maximum number of tokens in the response',
  //   example: 1000,
  //   required: false,
  //   minimum: 1,
  //   maximum: 4096,
  // })
  // @IsOptional()
  // @IsNumber({}, { message: 'Max tokens must be a number' })
  // @Min(1, { message: 'Max tokens must be at least 1' })
  // @Max(4096, { message: 'Max tokens must be at most 4096' })
  // maxTokens?: number;
}
