import { PartialType } from '@nestjs/swagger';
import { CreateSocketGatewayDto } from './create-socket-gateway.dto';

export class UpdateSocketGatewayDto extends PartialType(CreateSocketGatewayDto) {}
