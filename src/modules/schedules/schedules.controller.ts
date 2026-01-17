
import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Get,
    Query,
    Patch,
    Delete,
    Param,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { GetSchedulesDto } from './dto/get-schedules.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@ApiTags('Schedules')
@Controller('schedules')
export class SchedulesController {
    constructor(private readonly schedulesService: SchedulesService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create doctor schedule(s)' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Schedule created successfully',
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid input',
    })
    @ApiResponse({
        status: HttpStatus.CONFLICT,
        description: 'Schedule already exists',
    })
    create(@Body() createScheduleDto: CreateScheduleDto) {
        return this.schedulesService.create(createScheduleDto);
    }

    @Get('options/shifts')
    @ApiOperation({ summary: 'Get clinic shifts for dropdown' })
    async getShifts(@Query('clinicId') clinicId: string) {
        return this.schedulesService.getShifts(clinicId);
    }

    @Get('options/rooms')
    @ApiOperation({ summary: 'Get clinic rooms for dropdown' })
    async getRooms(@Query('clinicId') clinicId: string) {
        return this.schedulesService.getRooms(clinicId);
    }

    @Get()
    @ApiOperation({ summary: 'Get schedules list' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'List of schedules',
    })
    findAll(@Query() query: GetSchedulesDto) {
        return this.schedulesService.findAll(query);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update schedule' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Schedule updated' })
    update(
        @Param('id') id: string,
        @Body() updateScheduleDto: UpdateScheduleDto,
    ) {
        return this.schedulesService.update(id, updateScheduleDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete schedule' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Schedule deleted' })
    remove(@Param('id') id: string) {
        return this.schedulesService.remove(id);
    }
}
