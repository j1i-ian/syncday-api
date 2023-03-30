/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import { Schedule } from '@entity/schedules/schedule.entity';
import { CreateScheduleDto } from '@dto/schedules/create-schedule.dto';
import { UpdateScheduleDto } from '@dto/schedules/update-schedule.dto';

@Injectable()
export class SchedulesService {
    findAll(): Schedule[] {
        return [] as Schedule[];
    }

    findOne(id: number): Schedule {
        return {} as Schedule;
    }

    create(createScheduleDto: CreateScheduleDto): Schedule {
        return {} as Schedule;
    }

    update(id: number, updateScheduleDto: UpdateScheduleDto): boolean {
        return true;
    }

    remove(id: number): boolean {
        return true;
    }
}
