import { ApiProperty } from '@nestjs/swagger';
import { Medicine } from '../entities/medicine.entity';

export class PaginatedMedicinesResponseDto {
  @ApiProperty({ type: [Medicine] })
  data: Medicine[];

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 250 })
  total: number;

  @ApiProperty({ example: 13 })
  totalPages: number;
}
