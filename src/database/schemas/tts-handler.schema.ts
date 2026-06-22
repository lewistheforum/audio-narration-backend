import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type TtsHandlerDocument = TtsHandler & Document;

@Schema({ timestamps: true })
export class TtsHandler {
  @Prop({ type: String, default: uuidv4 })
  _id: string;

  @Prop({ type: String, ref: 'RawSource' })
  rawSourceId: string;

  @Prop({ type: String, ref: 'ProcessingTracking' })
  processingTrackingId: string;

  @Prop()
  path: string;

  @Prop()
  totalFiles: number;

  @Prop()
  fileType: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const TtsHandlerSchema = SchemaFactory.createForClass(TtsHandler);
