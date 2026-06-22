import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type SttHandlerDocument = SttHandler & Document;

@Schema({ timestamps: true })
export class SttHandler {
  @Prop({ type: String, default: uuidv4 })
  _id: string;

  @Prop({ type: String, ref: 'RawSource' })
  rawSourceId: string;

  @Prop({ type: String, ref: 'ProcessingTracking' })
  processingTrackingId: string;

  @Prop()
  pathTransJSON: string;

  @Prop()
  pathTransSRT: string;

  @Prop()
  fileNameTransJSON: string;

  @Prop()
  fileNameTransSRT: string;

  @Prop()
  fileType: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const SttHandlerSchema = SchemaFactory.createForClass(SttHandler);
