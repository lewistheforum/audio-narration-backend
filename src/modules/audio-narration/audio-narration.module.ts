import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProcessingTracking, ProcessingTrackingSchema } from '../../database/schemas/processing-tracking.schema';
import { RawSource, RawSourceSchema } from '../../database/schemas/raw-source.schema';
import { AudioSplitHandler, AudioSplitHandlerSchema } from '../../database/schemas/audio-split-handler.schema';
import { AudioBackgroundHandler, AudioBackgroundHandlerSchema } from '../../database/schemas/audio-background-handler.schema';
import { SttHandler, SttHandlerSchema } from '../../database/schemas/stt-handler.schema';
import { TranslateScriptHandler, TranslateScriptHandlerSchema } from '../../database/schemas/translate-script-handler.schema';
import { TtsHandler, TtsHandlerSchema } from '../../database/schemas/tts-handler.schema';
import { MergeVoiceHandler, MergeVoiceHandlerSchema } from '../../database/schemas/merge-voice-handler.schema';
import { FinalSource, FinalSourceSchema } from '../../database/schemas/final-source.schema';
import { AudioNarrationService } from './audio-narration.service';
import { AudioNarrationController } from './audio-narration.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProcessingTracking.name, schema: ProcessingTrackingSchema },
      { name: RawSource.name, schema: RawSourceSchema },
      { name: AudioSplitHandler.name, schema: AudioSplitHandlerSchema },
      { name: AudioBackgroundHandler.name, schema: AudioBackgroundHandlerSchema },
      { name: SttHandler.name, schema: SttHandlerSchema },
      { name: TranslateScriptHandler.name, schema: TranslateScriptHandlerSchema },
      { name: TtsHandler.name, schema: TtsHandlerSchema },
      { name: MergeVoiceHandler.name, schema: MergeVoiceHandlerSchema },
      { name: FinalSource.name, schema: FinalSourceSchema },
    ]),
  ],
  controllers: [AudioNarrationController],
  providers: [AudioNarrationService],
  exports: [MongooseModule, AudioNarrationService],
})
export class AudioNarrationModule {}
