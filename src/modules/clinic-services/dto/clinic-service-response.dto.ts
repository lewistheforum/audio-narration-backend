import { ApiProperty } from '@nestjs/swagger';
import { ClinicService } from '../entities/clinic-service.entity';
import { ClinicServiceConfig } from '../../service-configs/entities/clinic-service-config.entity';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class ClinicServiceResponseDto {
    @ApiProperty()
    @Expose()
    _id: string;

    @ApiProperty()
    @Expose()
    categoryId: string;

    @ApiProperty()
    @Expose()
    serviceName: string;

    @ApiProperty()
    @Expose()
    serviceCode: string;

    @ApiProperty({ required: false })
    @Expose()
    description?: string;

    @ApiProperty({ type: [String], required: false })
    @Expose()
    serviceFunctions?: string[];

    @ApiProperty()
    @Expose()
    isActive: boolean;

    @ApiProperty()
    @Expose()
    price: number;

    @ApiProperty()
    @Expose()
    discount: number;

    @ApiProperty({ required: false })
    @Expose()
    durationMin?: number;

    @ApiProperty({ required: false })
    @Expose()
    noteForPatient?: string;

    constructor(service: ClinicService, config?: ClinicServiceConfig) {
        this._id = config?._id || service._id;
        this.categoryId = service.categoryId;
        this.serviceName = service.serviceName;
        this.serviceCode = service.serviceCode;
        this.description = service.description;
        this.serviceFunctions = service.serviceFunctions;
        this.isActive = service.isActive;

        if (config) {
            this.price = Number(config.price);
            this.discount = Number(config.discount);
            this.durationMin = config.durationMin;
            this.noteForPatient = config.noteForPatient;
            // The service's active status takes precedence, but if you want config to override, you can handle it here.
            // Wait, the API manages both isActive at the same time, so they should be sync.
        }
    }
}
