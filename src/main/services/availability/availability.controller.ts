import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
    Put,
    Delete
} from '@nestjs/common';
import { Observable, from, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { AuthUser } from '@decorators/auth-user.decorator';
import { CreateAvailabilityRequestDto } from '@dto/availability/create-availability-request.dto';
import { UpdateAvailabilityRequestDto } from '@dto/availability/update-availability-request.dto';
import { CreateAvailabilityResponseDto } from '@dto/availability/create-availability-response.dto';
import { GetAvailabilityResponseDto } from '@dto/availability/get-availability-response.dto';
import { AvailabilitySearchOption } from '@app/interfaces/availability/availability-search-option.interface';
import { AvailabilityService } from './availability.service';

@Controller()
export class AvailabilityController {
    constructor(private readonly availabilityService: AvailabilityService) {}

    @Get()
    searchAvailabilities(
        @Query() availabilitySearchOption: AvailabilitySearchOption,
        @AuthUser('id') userId: number,
        @AuthUser('uuid') userUUID: string
    ): Observable<GetAvailabilityResponseDto[]> {
        return this.availabilityService
            .search({
                ...availabilitySearchOption,
                userId,
                userUUID
            })
            .pipe(
                map((loadedAvailabilities) =>
                    loadedAvailabilities.map((_loadedAvailability) =>
                        plainToInstance(GetAvailabilityResponseDto, _loadedAvailability, {
                            excludeExtraneousValues: true
                        })
                    )
                )
            );
    }

    @Get(':availabilityId')
    fetchAvailabilityDetail(
        @Param('availabilityId', ParseIntPipe) availabilityId: number,
        @AuthUser('id') userId: number,
        @AuthUser('uuid') userUUID: string
    ): Observable<GetAvailabilityResponseDto> {
        return this.availabilityService.fetchDetail(availabilityId, userId, userUUID).pipe(
            map((loadedAvailability) =>
                plainToInstance(GetAvailabilityResponseDto, loadedAvailability, {
                    excludeExtraneousValues: true
                })
            )
        );
    }

    @Post()
    create(
        @AuthUser('id') userId: number,
        @AuthUser('uuid') userUUID: string,
        @Body() createAvailabilityDto: CreateAvailabilityRequestDto
    ): Observable<CreateAvailabilityResponseDto> {
        return from(this.availabilityService.create(userId, userUUID, createAvailabilityDto)).pipe(
            map((loadedAvailability) =>
                plainToInstance(CreateAvailabilityResponseDto, loadedAvailability, {
                    excludeExtraneousValues: true
                })
            )
        );
    }

    @Put(':availabilityId')
    @HttpCode(HttpStatus.NO_CONTENT)
    update(
        @Param('availabilityId', ParseIntPipe) availabilityId: number,
        @AuthUser('uuid') userUUID: string,
        @Body() updateAvailabilityDto: UpdateAvailabilityRequestDto
    ): Observable<boolean> {
        return from(
            this.availabilityService.update(availabilityId, userUUID, updateAvailabilityDto)
        );
    }

    @Delete(':availabilityId')
    @HttpCode(HttpStatus.NO_CONTENT)
    delete(
        @Param('availabilityId', ParseIntPipe) availabilityId: number,
        @AuthUser('id') userId: number,
        @AuthUser('uuid') userUUID: string
    ): Observable<boolean> {
        return from(this.availabilityService.remove(availabilityId, userId, userUUID));
    }
}
