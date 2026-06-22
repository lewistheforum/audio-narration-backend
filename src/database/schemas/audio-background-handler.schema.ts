import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type AudioBackgroundHandlerDocument = AudioBackgroundHandler & Document;

@Schema({ timestamps: true })
export class AudioBackgroundHandler {
  @Prop({ type: String, default: uuidv4 })
  _id: string;

  @Prop({ type: String, ref: 'RawSource' })
  rawSourceId: string;

  @Prop({ type: String, ref: 'ProcessingTracking' })
  processingTrackingId: string;

  @Prop()
  pathVocal: string;

  @Prop()
  pathNoVocal: string;

  @Prop()
  fileNameVocal: string;

  @Prop()
  lengthVocal: number;

  @Prop()
  fileNameNoVocal: string;

  @Prop()
  lengthNoVocal: number;

  @Prop()
  fileTypeVocal: string;

  @Prop()
  fileTypeNoVocal: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const AudioBackgroundHandlerSchema = SchemaFactory.createForClass(AudioBackgroundHandler);
