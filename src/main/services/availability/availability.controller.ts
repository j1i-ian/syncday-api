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
import { AuthProfile } from '@decorators/auth-profile.decorator';
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
        @AuthProfile('teamId') teamId: number,
        @AuthProfile('teamUUID') teamUUID: string
    ): Observable<GetAvailabilityResponseDto[]> {
        return this.availabilityService
            .search({
                ...availabilitySearchOption,
                teamId,
                teamUUID
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
        @AuthProfile('teamId') teamId: number,
        @AuthProfile('teamUUID') teamUUID: string
    ): Observable<GetAvailabilityResponseDto> {
        return this.availabilityService.fetchDetail(teamId, teamUUID, availabilityId).pipe(
            map((loadedAvailability) =>
                plainToInstance(GetAvailabilityResponseDto, loadedAvailability, {
                    excludeExtraneousValues: true
                })
            )
        );
    }

    @Post()
    create(
        @AuthProfile('teamId') teamId: number,
        @AuthProfile('teamUUID') teamUUID: string,
        @Body() createAvailabilityDto: CreateAvailabilityRequestDto
    ): Observable<CreateAvailabilityResponseDto> {
        return from(this.availabilityService.create(teamId, teamUUID, createAvailabilityDto)).pipe(
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
        @AuthProfile('teamId') teamId: number,
        @AuthProfile('teamUUID') teamUUID: string,
        @Param('availabilityId', ParseIntPipe) availabilityId: number,
        @Body() updateAvailabilityDto: UpdateAvailabilityRequestDto
    ): Observable<boolean> {
        return from(
            this.availabilityService.update(teamId, teamUUID, availabilityId, updateAvailabilityDto)
        );
    }

    @Patch()
    @HttpCode(HttpStatus.NO_CONTENT)
    patchAll(
        @AuthProfile('uuid') teamUUID: string,
        @Body() patchAvailabilityDto: PatchAvailabilityRequestDto
    ): Observable<boolean> {
        return from(this.availabilityService.patchAll(teamUUID, patchAvailabilityDto));
    }

    @Patch(':availabilityId')
    @HttpCode(HttpStatus.NO_CONTENT)
    patch(
        @AuthProfile('teamId') teamId: number,
        @AuthProfile('teamUUID') teamUUID: string,
        @Param('availabilityId', ParseIntPipe) availabilityId: number,
        @Body() patchAvailabilityDto: PatchAvailabilityRequestDto
    ): Observable<boolean> {
        return from(
            this.availabilityService.patch(teamId, teamUUID, availabilityId, patchAvailabilityDto)
        );
    }

    @Delete(':availabilityId')
    @HttpCode(HttpStatus.NO_CONTENT)
    delete(
        @AuthProfile('teamId') teamId: number,
        @AuthProfile('teamUUID') teamUUID: string,
        @Param('availabilityId', ParseIntPipe) availabilityId: number
    ): Observable<boolean> {
        return from(this.availabilityService.remove(availabilityId, teamId, teamUUID));
    }

    clone(
        availabilityId: number,
        teamId: number,
        teamUUID: string,
        cloneAvailabilityOption: CloneAvailabilityRequestDto = {
            cloneSuffix: ' (cloned)'
        }
    ): Promise<Availability> {
        return this.availabilityService.clone(
            availabilityId,
            teamId,
            teamUUID,
            cloneAvailabilityOption
        );
    }

    linkToEvents(teamId: number, availabilityId: number, eventIds: number[]): Promise<boolean> {
        return this.availabilityService.linkToEvents(teamId, availabilityId, eventIds);
    }

    unlinkToEvents(teamId: number, availabilityId: number): Promise<boolean> {
        return this.availabilityService.unlinkToEvents(teamId, availabilityId);
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
        @AuthProfile('teamId') teamId: number,
        @AuthProfile('teamUUID') teamUUID: string,
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
                    teamId,
                    teamUUID,
                    requestBody
                );
                statusCode = HttpStatus.CREATED;
                break;
            case 'LINK':
                responseBody = await this.linkToEvents(
                    teamId,
                    parsedAvailabilityId,
                    eventIds as number[]
                );
                statusCode = HttpStatus.NO_CONTENT;
                break;
            case 'UNLINK':
                await this.unlinkToEvents(teamId, parsedAvailabilityId);
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
