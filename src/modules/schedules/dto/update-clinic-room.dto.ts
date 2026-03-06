import { PartialType } from '@nestjs/swagger';
import { CreateClinicRoomDto } from './create-clinic-room.dto';

export class UpdateClinicRoomDto extends PartialType(CreateClinicRoomDto) { }
