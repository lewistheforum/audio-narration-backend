import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';

/**
 * Admin Approval DTO
 *
 * Request body for approve/reject actions
 */
export class AdminApprovalDto {
  @ApiProperty({
    description: 'Action to perform',
    enum: ['APPROVE', 'REJECT'],
  })
  @IsEnum(['APPROVE', 'REJECT'], {
    message: 'Action must be either APPROVE or REJECT',
  })
  action: 'APPROVE' | 'REJECT';
}
