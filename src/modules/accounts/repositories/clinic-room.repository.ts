import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ClinicRoom } from '../../schedules/entities/clinic_room.entity';

@Injectable()
export class ClinicRoomRepository extends Repository<ClinicRoom> {
  constructor(private dataSource: DataSource) {
    super(ClinicRoom, dataSource.createEntityManager());
  }
}
