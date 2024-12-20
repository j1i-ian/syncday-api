import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Patch,
    Post,
    Res
} from '@nestjs/common';
import { Observable, catchError, filter, of, tap, throwIfEmpty } from 'rxjs';
import { Response } from 'express';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { Roles } from '@decorators/roles.decorator';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { Role } from '@interfaces/profiles/role.enum';
import { Orderer } from '@interfaces/orders/orderer.interface';
import { TeamService } from '@services/team/team.service';
import { Team } from '@entity/teams/team.entity';
import { TeamSetting } from '@entity/teams/team-setting.entity';
import { PaymentMethod } from '@entity/payments/payment-method.entity';
import { CreateTeamRequestDto } from '@dto/teams/create-team-request.dto';
import { BootpayException } from '@exceptions/bootpay.exception';

@Controller()
export class TeamController {

    constructor(
        private readonly teamService: TeamService
    ) {}

    @Get()
    search(
        @AuthProfile('userId') userId: number
    ): Observable<Team[]> {
        return this.teamService.search(userId);
    }

    @Get(':teamId(\\d+)')
    get(
        @AuthProfile('teamId') teamId: number,
        @AuthProfile('userId') userId: number
    ): Observable<Team> {
        return this.teamService.get(teamId, userId);
    }

    @Post()
    create(
        @AuthProfile() authProfile: AppJwtPayload,
        @Body() createTeamRequestDto: CreateTeamRequestDto
    ): Observable<Team> {

        const { unit: orderUnit } = createTeamRequestDto.order;
        const newTeam = {
            name: createTeamRequestDto.name,
            logo: createTeamRequestDto.logo
        } as Team;
        const newTeamSetting = {
            workspace: createTeamRequestDto.link,
            greetings: createTeamRequestDto.greetings
        } as Pick<TeamSetting, 'workspace' | 'greetings'>;

        const newPaymentMethod = createTeamRequestDto.paymentMethod;
        const newTeamMembers = createTeamRequestDto.invitedMembers
            .filter((_member) => _member.email !== authProfile.email);

        if (orderUnit !== newTeamMembers.length + 1) {
            throw new BadRequestException('Order unit is invalid. Plase check your order option');
        }

        const orderer = {
            name: authProfile.name,
            roles: authProfile.roles,
            teamId: authProfile.teamId
        } as Orderer;

        return this.teamService.create(
            orderUnit,
            newPaymentMethod as unknown as PaymentMethod,
            newTeam,
            newTeamSetting,
            newTeamMembers,
            orderer,
            authProfile.userId
        );
    }

    @Patch(':teamId(\\d+)')
    @Roles(Role.OWNER, Role.MANAGER)
    @HttpCode(HttpStatus.NO_CONTENT)
    patch(
        @AuthProfile('teamId') teamId: number,
        @Body() patchTeamRequestDto: Pick<Team, 'name' | 'logo'>
    ): Observable<boolean> {
        return this.teamService.patch(teamId, {
            name: patchTeamRequestDto.name,
            logo: patchTeamRequestDto.logo
        });
    }

    @Delete(':teamId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(Role.OWNER)
    remove(
        @AuthProfile() authProfile: AppJwtPayload,
        @Res() response: Response
    ): Observable<boolean> {
        return this.teamService.delete(authProfile)
            .pipe(
                tap(() => {
                    response.status(HttpStatus.NO_CONTENT).json();
                }),
                catchError((errorOrBootpayException) =>
                    of(errorOrBootpayException)
                        .pipe(
                            filter((errorOrBootpayException) => errorOrBootpayException instanceof BootpayException),
                            tap(() => {
                                response.status(208).json({
                                    exception: errorOrBootpayException.name,
                                    message: errorOrBootpayException.message
                                });
                            }),
                            throwIfEmpty(() => errorOrBootpayException)
                        )
                )
            );
    }
}
