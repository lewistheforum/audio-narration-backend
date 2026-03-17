import { OmitType } from '@nestjs/swagger';
import { CreateTransactionDto } from './create-transaction.dto';

export class CreateTransactionBodyDto extends OmitType(CreateTransactionDto, [
  'appointmentId',
] as const) {}
