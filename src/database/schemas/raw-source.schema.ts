import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type RawSourceDocument = RawSource & Document;

@Schema({ timestamps: true })
export class RawSource {
  @Prop({ type: String, default: uuidv4 })
  _id: string;

  @Prop()
  originalUrl: string;

  @Prop()
  type: string;

  @Prop()
  videoLength: number;

  @Prop()
  path: string;

  @Prop()
  fileSize: number;

  @Prop()
  fileType: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const RawSourceSchema = SchemaFactory.createForClass(RawSource);
