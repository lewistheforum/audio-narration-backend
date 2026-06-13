import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Video } from './video.schema';

export type VideoMetadataDocument = VideoMetadata & Document;

@Schema({ timestamps: true })
export class VideoMetadata {
  @Prop({ type: String, default: uuidv4,  })
  _id: string;

  @Prop({ type: String, ref: Video.name, required: true })
  video_id: string;

  @Prop()
  title_vi: string;

  @Prop()
  description_vi: string;

  @Prop({ type: [String], default: [] })
  hashtags: string[];

  @Prop()
  thumbnail_prompts: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  published_urls: Record<string, any>;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const VideoMetadataSchema = SchemaFactory.createForClass(VideoMetadata);
