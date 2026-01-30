import { PartialType } from '@nestjs/swagger';
import { CreateMedicineDto } from './create-medicine.dto';

/**
 * Update Medicine DTO
 * 
 * Data Transfer Object for updating existing medicine records
 * All fields are optional (extends CreateMedicineDto with PartialType)
 */
export class UpdateMedicineDto extends PartialType(CreateMedicineDto) {}
