import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Video } from './video.schema';

export type ProcessingJobDocument = ProcessingJob & Document;

@Schema({ timestamps: true })
export class ProcessingJob {
  @Prop({ type: String, default: uuidv4,  })
  _id: string;

  @Prop({ type: String, ref: Video.name, required: true })
  video_id: string;

  @Prop({ type: Number, min: 1, max: 9, default: 1 })
  current_step: number;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  step_logs: Record<string, any>;

  @Prop()
  error_message: string;

  @Prop()
  started_at: Date;

  @Prop()
  completed_at: Date;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const ProcessingJobSchema = SchemaFactory.createForClass(ProcessingJob);
