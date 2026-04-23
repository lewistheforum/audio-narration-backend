import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiCronController } from './ai.cron.controller';
import { AiService } from './ai.service';
import { GeminiService } from './services/gemini.service';
import { ChatGptService } from './services/chatgpt.service';
import { ReportsModule } from '../reports/reports.module';
import { HttpModule } from '@nestjs/axios';
import { AccountsModule } from '../accounts/accounts.module';

/**
 * AI Module
 *
 * Provides AI integration services for the Medicare Backend.
 *
 * Features:
 * - Google Gemini API integration
 * - OpenAI ChatGPT API integration
 * - Unified chat completion interface
 * - Multi-turn conversation support
 * - Configurable model and parameters
 *
 * Configuration Required:
 * - GEMINI_API_KEY: Google Gemini API key
 * - OPENAI_API_KEY: OpenAI API key
 *
 * Endpoints:
 * - POST /ai/chat - Generate AI chat completions
 */
@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ReportsModule),
    HttpModule,
    forwardRef(() => AccountsModule),
  ],
  controllers: [AiController],
  providers: [AiService, GeminiService, ChatGptService, AiCronController],
  exports: [AiService],
})
export class AiModule {}
