import { PartialType } from '@nestjs/swagger';
import { CreateClinicShiftHourDto } from './create-clinic-shift-hour.dto';

export class UpdateClinicShiftHourDto extends PartialType(CreateClinicShiftHourDto) { }
