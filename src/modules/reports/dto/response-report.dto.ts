import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResponseReportDto {
  @ApiProperty({
    description: 'Description of the response to the user report',
    example: 'We have reviewed your report and taken appropriate action.',
  })
  @IsNotEmpty()
  @IsString()
  responseDescription: string;
}
