import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateClinicRoomDto {
    @ApiProperty({ description: 'Room name (e.g., Room 101, Dental Care)' })
    @IsNotEmpty()
    @IsString()
    @MaxLength(255)
    roomName: string;
}
