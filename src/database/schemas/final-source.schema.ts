import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type FinalSourceDocument = FinalSource & Document;

@Schema({ timestamps: true })
export class FinalSource {
  @Prop({ type: String, default: uuidv4 })
  _id: string;

  @Prop({ type: String, ref: 'RawSource' })
  rawSourceId: string;

  @Prop({ type: String, ref: 'User' })
  userId: string;

  @Prop()
  status: string;

  @Prop()
  pathFinalAudio: string;

  @Prop()
  pathFinalNoVocal: string;

  @Prop()
  pathOriginVideo: string;

  @Prop()
  finalResult: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const FinalSourceSchema = SchemaFactory.createForClass(FinalSource);
