import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Header,
    HttpCode,
    HttpStatus,
    Patch,
    Post,
    Put
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { Observable, map } from 'rxjs';
import { User } from '@core/entities/users/user.entity';
import { BCP47AcceptLanguage } from '@decorators/accept-language.decorator';
import { Language } from '@interfaces/users/language.enum';
import { CreatedUserTeamProfile } from '@services/users/created-user-team-profile.interface';
import { PatchUserRequestDto } from '@dto/users/patch-user-request.dto';
import { CreateUserResponseDto } from '@dto/users/create-user-response.dto';
import { UpdateUserPasswordsVO } from '@dto/users/update-user-password.vo';
import { UpdatePhoneWithVerificationDto } from '@dto/verifications/update-phone-with-verification.dto';
import { CreateUserWithEmailVerificationDto } from '@dto/users/create-user-with-email-verification.dto';
import { CreateUserWithPhoneVerificationDto } from '@dto/users/create-user-with-phone-verification.dto';
import { AuthProfile } from '../../decorators/auth-profile.decorator';
import { Public } from '../../auth/strategy/jwt/public.decorator';
import { UserService } from './user.service';

@Controller()
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get(':userId(\\d+)')
    async fetchUser(@AuthProfile('userId') userId: number): Promise<User> {
        const loadedUser = await this.userService.findUser({ userId });

        return loadedUser;
    }

    /**
     * Verification is processed with email of user.
     * So when user loaded then rendered page would send ajax
     * transmission to this api only with auth code.
     * Therefore this api should be public.
     *
     * @param id issued verification id
     * @param createUserWithEmailOrPhoneVerificationDto
     * @returns
     */
    @Post()
    @Public()
    @Header('Content-type', 'application/json')
    createUserWithEmailOrPhoneVerification(
        @BCP47AcceptLanguage() language: Language,
        @Body() createUserWithEmailOrPhoneVerificationDto: CreateUserWithEmailVerificationDto | CreateUserWithPhoneVerificationDto
    ): Observable<CreateUserResponseDto> {

        let createUser$: Observable<CreatedUserTeamProfile>;

        if (createUserWithEmailOrPhoneVerificationDto instanceof CreateUserWithEmailVerificationDto) {
            const { email, verificationCode, timezone } = createUserWithEmailOrPhoneVerificationDto;

            createUser$ = this.userService.createUser(
                email,
                verificationCode,
                timezone
            );
        } else {
            const {
                phone,
                plainPassword,
                name,
                uuid,
                timezone
            } = createUserWithEmailOrPhoneVerificationDto;

            createUser$ = this.userService.createUser(
                phone,
                plainPassword,
                name,
                uuid,
                timezone,
                language
            );

        }

        return createUser$.pipe(
            map(({ createdUser }) => plainToInstance(CreateUserResponseDto, createdUser, {
                excludeExtraneousValues: true
            }))
        );
    }

    @Patch(':userId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async patchUser(
        @AuthProfile('userId') userId: number,
        @Body() patchUserBody: PatchUserRequestDto
    ): Promise<void> {
        const result = await this.userService.patch(userId, patchUserBody);

        if (result === false) {
            throw new BadRequestException('Cannot update user data');
        }
    }

    @Put(':userId(\\d+)/passwords')
    @HttpCode(HttpStatus.NO_CONTENT)
    async updateUserPassword(
        @AuthProfile('userId') userId: number,
        @Body() patchUserBody: UpdateUserPasswordsVO
    ): Promise<void> {
        const result = await this.userService.updateUserPassword(userId, patchUserBody);

        if (result === false) {
            throw new BadRequestException('Cannot update user data');
        }
    }

    @Put(':userId(\\d+)/phone')
    @HttpCode(HttpStatus.NO_CONTENT)
    async updateUserPhone(
        @AuthProfile('userId') userId: number,
        @AuthProfile('userUUID') userUUID: string,
        @Body() patchUserBody: UpdatePhoneWithVerificationDto
    ): Promise<void> {
        const result = await this.userService.updateUserPhone(userId, userUUID, patchUserBody);

        if (result === false) {
            throw new BadRequestException('Cannot update user data');
        }
    }

    @Delete(':userId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteUser(
        @AuthProfile('userId') userId: number
    ): Promise<void> {
        await this.userService.deleteUser(userId);
    }
}
