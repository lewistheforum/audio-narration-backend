import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type TranslateScriptHandlerDocument = TranslateScriptHandler & Document;

@Schema({ timestamps: true })
export class TranslateScriptHandler {
  @Prop({ type: String, default: uuidv4 })
  _id: string;

  @Prop({ type: String, ref: 'RawSource' })
  rawSourceId: string;

  @Prop({ type: String, ref: 'ProcessingTracking' })
  processingTrackingId: string;

  @Prop()
  pathTransVi: string;

  @Prop()
  fileNameTransVi: string;

  @Prop()
  fileType: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const TranslateScriptHandlerSchema = SchemaFactory.createForClass(TranslateScriptHandler);
