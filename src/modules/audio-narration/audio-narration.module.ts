import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Video, VideoSchema } from '../../database/schemas/video.schema';
import { ProcessingJob, ProcessingJobSchema } from '../../database/schemas/processing-job.schema';
import { VideoMetadata, VideoMetadataSchema } from '../../database/schemas/video-metadata.schema';
import { Transcript, TranscriptSchema } from '../../database/schemas/transcript.schema';
import { AudioNarrationService } from './audio-narration.service';
import { AudioNarrationController } from './audio-narration.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Video.name, schema: VideoSchema },
      { name: ProcessingJob.name, schema: ProcessingJobSchema },
      { name: VideoMetadata.name, schema: VideoMetadataSchema },
      { name: Transcript.name, schema: TranscriptSchema },
    ]),
  ],
  controllers: [AudioNarrationController],
  providers: [AudioNarrationService],
  exports: [MongooseModule, AudioNarrationService],
})
export class AudioNarrationModule {}
