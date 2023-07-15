import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Header,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Put
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { User } from '@core/entities/users/user.entity';
import { CreateUserWithVerificationDto } from '@dto/verifications/create-user-with-verification.dto';
import { PatchUserRequestDto } from '@dto/users/patch-user-request.dto';
import { CreateUserResponseDto } from '@dto/users/create-user-response.dto';
import { UpdateUserPasswordsVO } from '@dto/users/update-user-password.vo';
import { UpdatePhoneWithVerificationDto } from '@dto/verifications/update-phone-with-verification.dto';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { AppJwtPayload } from '../../auth/strategy/jwt/app-jwt-payload.interface';
import { Public } from '../../auth/strategy/jwt/public.decorator';
import { UserService } from './user.service';

@Controller()
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get(':userId(\\d+)')
    async fetchUser(@AuthUser() authUser: AppJwtPayload): Promise<User> {
        const loadedUser = await this.userService.findUserById(authUser.id);

        return loadedUser;
    }

    /**
     * Verification is processed with email of user.
     * So when user loaded then rendered page would send ajax
     * transmission to this api only with auth code.
     * Therefore this api should be public.
     *
     * @param id issued verification id
     * @param createUserWithVerificationDto
     * @returns
     */
    @Post()
    @Public()
    @Header('Content-type', 'application/json')
    async createUserWithEmailVerification(
        @Body() createUserWithVerificationDto: CreateUserWithVerificationDto
    ): Promise<CreateUserResponseDto> {
        const { email, verificationCode, timezone } = createUserWithVerificationDto;
        const createdUser = await this.userService.createUserWithVerificationByEmail(
            email,
            verificationCode,
            timezone
        );

        return plainToInstance(CreateUserResponseDto, createdUser, {
            excludeExtraneousValues: true
        });
    }

    @Patch(':userId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async patchUser(
        @AuthUser() authUser: AppJwtPayload,
        @Body() patchUserBody: PatchUserRequestDto
    ): Promise<void> {
        const result = await this.userService.patch(authUser.id, {
            name: patchUserBody.name
        });

        if (result === false) {
            throw new BadRequestException('Cannot update user data');
        }
    }

    @Put(':userId(\\d+)/passwords')
    @HttpCode(HttpStatus.NO_CONTENT)
    async updateUserPassword(
        @AuthUser() authUser: AppJwtPayload,
        @Body() patchUserBody: UpdateUserPasswordsVO
    ): Promise<void> {
        const result = await this.userService.updateUserPassword(authUser.id, patchUserBody);

        if (result === false) {
            throw new BadRequestException('Cannot update user data');
        }
    }

    @Put(':userId(\\d+)/phone')
    @HttpCode(HttpStatus.NO_CONTENT)
    async updateUserPhone(
        @AuthUser() authUser: AppJwtPayload,
        @Body() patchUserBody: UpdatePhoneWithVerificationDto
    ): Promise<void> {
        const result = await this.userService.updateUserPhone(authUser.id, patchUserBody);

        if (result === false) {
            throw new BadRequestException('Cannot update user data');
        }
    }

    @Delete(':userId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteUser(
        @Param('userId', ParseIntPipe) userId: number
    ): Promise<void> {
        await this.userService.deleteUser(userId);
    }
}
