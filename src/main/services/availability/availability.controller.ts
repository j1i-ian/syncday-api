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
    Delete,
    Patch,
    All,
    Req,
    Res,
    NotImplementedException
} from '@nestjs/common';
import { Observable, from, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { Request, Response } from 'express';
import { AuthUser } from '@decorators/auth-user.decorator';
import { Matrix } from '@decorators/matrix.decorator';
import { Availability } from '@entity/availability/availability.entity';
import { CreateAvailabilityRequestDto } from '@dto/availability/create-availability-request.dto';
import { UpdateAvailabilityRequestDto } from '@dto/availability/update-availability-request.dto';
import { CreateAvailabilityResponseDto } from '@dto/availability/create-availability-response.dto';
import { GetAvailabilityResponseDto } from '@dto/availability/get-availability-response.dto';
import { PatchAvailabilityRequestDto } from '@dto/availability/patch-availability-request.dto';
import { CloneAvailabilityRequestDto } from '@dto/availability/clone-availability-options.dto';
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
                    plainToInstance(GetAvailabilityResponseDto, loadedAvailabilities, {
                        excludeExtraneousValues: true
                    })
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

    @Patch(':availabilityId')
    @HttpCode(HttpStatus.NO_CONTENT)
    patch(
        @Param('availabilityId', ParseIntPipe) availabilityId: number,
        @AuthUser('id') userId: number,
        @AuthUser('uuid') userUUID: string,
        @Body() patchAvailabilityDto: PatchAvailabilityRequestDto
    ): Observable<boolean> {
        return from(
            this.availabilityService.patch(availabilityId, userId, userUUID, patchAvailabilityDto)
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

    clone(
        availabilityId: number,
        userId: number,
        userUUID: string,
        cloneAvailabilityOption: CloneAvailabilityRequestDto = {
            cloneSuffix: ' (cloned)'
        }
    ): Promise<Availability> {
        return this.availabilityService.clone(
            availabilityId,
            userId,
            userUUID,
            cloneAvailabilityOption
        );
    }

    linkToEvents(userId: number, availabilityId: number, eventIds: number[]): Promise<boolean> {
        return this.availabilityService.linkToEvents(userId, availabilityId, eventIds);
    }

    unlinkToEvents(userId: number, availabilityId: number): Promise<boolean> {
        return this.availabilityService.unlinkToEvents(userId, availabilityId);
    }

    /**
     * Accept http method which is not officially supported by Nest.js
     *
     * @see {@link [related stackoverflow thread](https://stackoverflow.com/questions/75513412/how-to-handle-http-copy-link-methods-in-nestjs-controller)}
     */
    @All(['', ':availabilityId'])
    async others(
        @Req() req: Request,
        @Res() response: Response,
        @AuthUser('id') userId: number,
        @AuthUser('uuid') userUUID: string,
        @Body() requestBody?: CloneAvailabilityRequestDto,
        @Matrix({
            key: 'eventId',
            parseInt: true
        })
        eventIds?: number[]
    ): Promise<void> {
        if (requestBody && Object.keys(requestBody).length === 0) {
            requestBody = undefined;
        }

        let responseBody;
        let statusCode = 500;

        const { availabilityId } = req.params;
        const ensuredAvailabilityId = availabilityId.split(';').shift() as string;
        const parsedAvailabilityId = +ensuredAvailabilityId;

        switch (req.method) {
            case 'COPY':
                responseBody = await this.clone(
                    parsedAvailabilityId,
                    userId,
                    userUUID,
                    requestBody
                );
                statusCode = HttpStatus.CREATED;
                break;
            case 'LINK':
                responseBody = await this.linkToEvents(
                    userId,
                    parsedAvailabilityId,
                    eventIds as number[]
                );
                statusCode = HttpStatus.NO_CONTENT;
                break;
            case 'UNLINK':
                await this.unlinkToEvents(userId, parsedAvailabilityId);
                statusCode = HttpStatus.NO_CONTENT;
                break;
            default:
                throw new NotImplementedException('Cannot found mapped method');
        }

        response.status(statusCode);
        if (responseBody) {
            response.json(responseBody);
        }
        response.end();
    }
}
