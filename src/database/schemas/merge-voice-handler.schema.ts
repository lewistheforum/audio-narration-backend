import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type MergeVoiceHandlerDocument = MergeVoiceHandler & Document;

@Schema({ timestamps: true })
export class MergeVoiceHandler {
  @Prop({ type: String, default: uuidv4 })
  _id: string;

  @Prop({ type: String, ref: 'RawSource' })
  rawSourceId: string;

  @Prop({ type: String, ref: 'ProcessingTracking' })
  processingTrackingId: string;

  @Prop()
  pathFinalAudio: string;

  @Prop()
  fileFinalAudio: string;

  @Prop()
  fileType: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const MergeVoiceHandlerSchema = SchemaFactory.createForClass(MergeVoiceHandler);
