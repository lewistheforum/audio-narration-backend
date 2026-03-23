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
export class AiChatRequestDto {
  @ApiProperty({
    description: 'Array of chat messages forming the conversation',
    type: [ChatMessageDto],
    example: [{ role: 'user', content: 'What are the symptoms of diabetes?' }],
  })
  @IsNotEmpty({ message: 'Messages are required' })
  @IsArray({ message: 'Messages must be an array' })
  @ArrayMinSize(1, { message: 'At least one message is required' })
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @ApiProperty({
    description: 'AI provider to use',
    enum: AiProvider,
    example: AiProvider.GEMINI,
  })
  @IsNotEmpty({ message: 'Provider is required' })
  @IsEnum(AiProvider, { message: 'Invalid AI provider' })
  provider: AiProvider;

  @ApiProperty({
    description: 'AI model to use',
    enum: AiModel,
    example: AiModel.GEMINI_3_FLASH,
    required: false,
  })
  @IsOptional()
  @IsEnum(AiModel, { message: 'Invalid AI model' })
  model?: AiModel;

}
