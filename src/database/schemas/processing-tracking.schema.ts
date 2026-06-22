import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type ProcessingTrackingDocument = ProcessingTracking & Document;

@Schema({ timestamps: true })
export class ProcessingTracking {
  @Prop({ type: String, default: uuidv4 })
  _id: string;

  @Prop({ type: String, ref: 'User' })
  userId: string;

  @Prop()
  status: string;

  @Prop({ type: Number, enum: [1, 2, 2.5, 3, 4, 5, 6, 7] })
  stepStatus: number;

  @Prop({ type: String, ref: 'RawSource' })
  rawSourceId: string;

  @Prop({ type: String, ref: 'AudioSplitHandler' })
  audioSplitHandlerId: string;

  @Prop({ type: String, ref: 'AudioBackgroundHandler' })
  audioBackgroundHandlerId: string;

  @Prop({ type: String, ref: 'SttHandler' })
  sttHandlerId: string;

  @Prop({ type: String, ref: 'TranslateScriptHandler' })
  translateScriptHandlerId: string;

  @Prop({ type: String, ref: 'TtsHandler' })
  ttsHandlerId: string;

  @Prop({ type: String, ref: 'MergeVoiceHandler' })
  mergeVoiceHandlerId: string;

  @Prop({ type: String })
  mergeFinalResultHandlerId: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const ProcessingTrackingSchema = SchemaFactory.createForClass(ProcessingTracking);
