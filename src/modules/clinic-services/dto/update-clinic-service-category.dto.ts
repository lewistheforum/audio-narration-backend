import { PartialType } from '@nestjs/swagger';
import { CreateClinicServiceCategoryDto } from './create-clinic-service-category.dto';

export class UpdateClinicServiceCategoryDto extends PartialType(
  CreateClinicServiceCategoryDto,
) {}
