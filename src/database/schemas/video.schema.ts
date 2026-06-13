import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type VideoDocument = Video & Document;

@Schema({ timestamps: true })
export class Video {
  @Prop({ type: String, default: uuidv4,  })
  _id: string;

  @Prop({ required: true })
  original_url: string;

  @Prop({ required: true, enum: ['tiktok', 'douyin', 'youtube'] })
  source_platform: string;

  @Prop()
  target_voice_id: string;

  @Prop({ enum: ['duck', 'demucs', 'none'] })
  bgm_mode: string;

  @Prop()
  s3_final_url: string;

  @Prop({
    default: 'pending',
    enum: ['pending', 'processing', 'completed', 'failed'],
  })
  status: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const VideoSchema = SchemaFactory.createForClass(Video);
