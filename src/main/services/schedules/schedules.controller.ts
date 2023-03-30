import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Schedule } from '@entity/schedules/schedule.entity';
import { CreateScheduleDto } from '@dto/schedules/create-schedule.dto';
import { UpdateScheduleDto } from '@dto/schedules/update-schedule.dto';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
export class SchedulesController {
    constructor(private readonly schedulesService: SchedulesService) {}

    @Get()
    findAll(): Schedule[] {
        return this.schedulesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string): Schedule {
        return this.schedulesService.findOne(+id);
    }

    @Post()
    create(@Body() createScheduleDto: CreateScheduleDto): Schedule {
        return this.schedulesService.create(createScheduleDto);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateScheduleDto: UpdateScheduleDto): boolean {
        return this.schedulesService.update(+id, updateScheduleDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string): boolean {
        return this.schedulesService.remove(+id);
    }
}
