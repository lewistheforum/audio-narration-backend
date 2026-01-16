import { PartialType } from '@nestjs/swagger';
import { CreateClinicServiceDto } from './create-clinic-service.dto';

export class UpdateClinicServiceDto extends PartialType(CreateClinicServiceDto) { }
