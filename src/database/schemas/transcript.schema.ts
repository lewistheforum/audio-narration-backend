import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Video } from './video.schema';

export type TranscriptDocument = Transcript & Document;

@Schema({ timestamps: true })
export class Transcript {
  @Prop({ type: String, default: uuidv4,  })
  _id: string;

  @Prop({ type: String, ref: Video.name, required: true })
  video_id: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  original_json: Record<string, any>;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  translated_json: Record<string, any>;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const TranscriptSchema = SchemaFactory.createForClass(Transcript);
