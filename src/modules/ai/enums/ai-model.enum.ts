/**
 * AI Model Enum
 *
 * Defines the available AI models for each provider.
 *
 * Gemini Models:
 * - GEMINI_PRO: Google's Gemini Pro model for general-purpose tasks
 * - GEMINI_PRO_VISION: Google's Gemini Pro Vision for multimodal tasks
 *
 * ChatGPT Models:
 * - GPT_4: OpenAI's GPT-4 model
 * - GPT_4_TURBO: OpenAI's GPT-4 Turbo model (faster, cheaper)
 * - GPT_3_5_TURBO: OpenAI's GPT-3.5 Turbo model
 * - GPT_5_MINI: OpenAI's GPT-5 Mini model
 */
export enum AiModel {
  // Gemini models
  GEMINI_3_FLASH = 'gemini-3-flash-preview',
  GEMINI_3_PRO = 'gemini-3-pro-preview',
  GEMINI_25_FLASH = 'gemini-2.5-flash',
  GEMINI_25_PRO = 'gemini-2.5-pro',

  // ChatGPT models
  GPT_4 = 'gpt-4',
  GPT_o4_MINI = 'o4-mini',
  GPT_4_TURBO = 'gpt-4-turbo-preview',
  GPT_3_5_TURBO = 'gpt-3.5-turbo',
  GPT_5_MINI = 'gpt-5-mini',
}
