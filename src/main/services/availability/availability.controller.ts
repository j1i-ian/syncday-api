import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
    Put,
    Delete,
    Patch,
    All,
    Req,
    Res,
    NotImplementedException,
    ForbiddenException
} from '@nestjs/common';
import { Observable, from, map } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { Request, Response } from 'express';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Matrix } from '@decorators/matrix.decorator';
import { Role } from '@interfaces/profiles/role.enum';
import { Availability } from '@entity/availability/availability.entity';
import { CreateAvailabilityRequestDto } from '@dto/availability/create-availability-request.dto';
import { UpdateAvailabilityRequestDto } from '@dto/availability/update-availability-request.dto';
import { CreateAvailabilityResponseDto } from '@dto/availability/create-availability-response.dto';
import { GetAvailabilityResponseDto } from '@dto/availability/get-availability-response.dto';
import { PatchAvailabilityRequestDto } from '@dto/availability/patch-availability-request.dto';
import { CloneAvailabilityRequestDto } from '@dto/availability/clone-availability-options.dto';
import { AvailabilityService } from './availability.service';

@Controller()
export class AvailabilityController {
    constructor(private readonly availabilityService: AvailabilityService) {}

    @Get()
    searchAvailabilities(
        @AuthProfile('id') profileId: number,
        @AuthProfile('uuid') profileUUID: string,
        @AuthProfile('teamId') teamId: number,
        @AuthProfile('teamUUID') teamUUID: string,
        @AuthProfile('roles') roles: Role[]
    ): Observable<GetAvailabilityResponseDto[]> {
        return this.availabilityService
            .search({
                teamId,
                teamUUID,
                profileId,
                profileUUID
            }, roles)
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
        @AuthProfile('id') profileId: number,
        @AuthProfile('teamUUID') teamUUID: string
    ): Observable<GetAvailabilityResponseDto> {
        return this.availabilityService.fetchDetail(
            teamUUID,
            profileId,
            availabilityId
        ).pipe(
            map((loadedAvailability) =>
                plainToInstance(GetAvailabilityResponseDto, loadedAvailability, {
                    excludeExtraneousValues: true
                })
            )
        );
    }

    @Post()
    create(
        @AuthProfile('id') profileId: number,
        @AuthProfile('teamUUID') teamUUID: string,
        @Body() createAvailabilityDto: CreateAvailabilityRequestDto
    ): Observable<CreateAvailabilityResponseDto> {
        return from(this.availabilityService.create(
            teamUUID,
            profileId,
            createAvailabilityDto
        )).pipe(
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
        @AuthProfile('id') profileId: number,
        @AuthProfile('teamUUID') teamUUID: string,
        @Param('availabilityId', ParseIntPipe) availabilityId: number,
        @Body() updateAvailabilityDto: UpdateAvailabilityRequestDto
    ): Observable<boolean> {
        return from(
            this.availabilityService.update(teamUUID, profileId, availabilityId, updateAvailabilityDto)
        );
    }

    @Patch()
    @HttpCode(HttpStatus.NO_CONTENT)
    patchAll(
        @AuthProfile('id') profileId: number,
        @AuthProfile('teamUUID') teamUUID: string,
        @Body() patchAvailabilityDto: PatchAvailabilityRequestDto
    ): Observable<boolean> {
        return from(this.availabilityService.patchAll(teamUUID, profileId, patchAvailabilityDto));
    }

    @Patch(':availabilityId')
    @HttpCode(HttpStatus.NO_CONTENT)
    patch(
        @AuthProfile('id') profileId: number,
        @AuthProfile('teamUUID') teamUUID: string,
        @Param('availabilityId', ParseIntPipe) availabilityId: number,
        @Body() patchAvailabilityDto: PatchAvailabilityRequestDto
    ): Observable<boolean> {
        return from(
            this.availabilityService.patch(teamUUID, profileId, availabilityId, patchAvailabilityDto)
        );
    }

    @Delete(':availabilityId')
    @HttpCode(HttpStatus.NO_CONTENT)
    delete(
        @AuthProfile('id') profileId: number,
        @AuthProfile('teamUUID') teamUUID: string,
        @Param('availabilityId', ParseIntPipe) availabilityId: number
    ): Observable<boolean> {
        return from(this.availabilityService.remove(teamUUID, profileId, availabilityId));
    }

    clone(
        teamId: number,
        teamUUID: string,
        profileId: number,
        availabilityId: number,
        cloneAvailabilityOption: CloneAvailabilityRequestDto = {
            cloneSuffix: ' (cloned)'
        }
    ): Promise<Availability> {
        return this.availabilityService.clone(
            teamId,
            teamUUID,
            profileId,
            availabilityId,
            cloneAvailabilityOption
        );
    }

    linkToEvents(teamId: number, profileId: number, availabilityId: number, eventIds: number[]): Promise<boolean> {
        return this.availabilityService.linkToEvents(teamId, profileId, availabilityId, eventIds);
    }

    unlinkToEvents(profileId: number, availabilityId: number): Promise<boolean> {
        return this.availabilityService.unlinkToEvents(profileId, availabilityId);
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
        @AuthProfile('id') profileId: number,
        @AuthProfile('teamId') teamId: number,
        @AuthProfile('teamUUID') teamUUID: string,
        @AuthProfile('roles') roles: Role[],
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
                    teamId,
                    teamUUID,
                    profileId,
                    parsedAvailabilityId,
                    requestBody
                );
                statusCode = HttpStatus.CREATED;
                break;
            case 'LINK':

                this._checkPermission(roles);

                responseBody = await this.linkToEvents(
                    teamId,
                    profileId,
                    parsedAvailabilityId,
                    eventIds as number[]
                );
                statusCode = HttpStatus.NO_CONTENT;
                break;
            case 'UNLINK':

                this._checkPermission(roles);

                await this.unlinkToEvents(profileId, parsedAvailabilityId);
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

    _checkPermission(roles: Role[]): void {
        if (
            roles.includes(Role.OWNER) === false
            && roles.includes(Role.MANAGER) === false
        ) {
            throw new ForbiddenException('Only owner or manager can perform link, unlink actions');
        }
    }
}
