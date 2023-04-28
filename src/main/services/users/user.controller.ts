import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { AppJwtPayload } from '../../auth/strategy/jwt/app-jwt-payload.interface';
import { UpdateUserSettingRequestDto } from '../../dto/users/update-user-setting-request.dto';
import { Public } from '../../auth/strategy/jwt/public.decorator';
import { CreateUserWithVerificationDto as CreateUserWithVerificationDto } from '../../dto/verifications/create-user-with-verification.dto';
import { FetchUserInfoResponseDto } from '../../dto/users/fetch-user-info-response.dto';
import { UserService } from './user.service';

@Controller()
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get(':userId')
    async fetchMyInfo(@AuthUser() authUser: AppJwtPayload): Promise<FetchUserInfoResponseDto> {
        const userInfo = await this.userService.fetchUserInfo(authUser.id, authUser.email);

        return plainToInstance(FetchUserInfoResponseDto, userInfo, {
            excludeExtraneousValues: true
        });
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
    update(@Body() createUserWithVerificationDto: CreateUserWithVerificationDto): Promise<boolean> {
        const { email, verificationCode } = createUserWithVerificationDto;
        return this.userService.createUserWithVerificationByEmail(email, verificationCode);
    }

    @Patch(':userId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    updateUser(
        @AuthUser() authUser: AppJwtPayload,
        @Body() newUserSetting: UpdateUserSettingRequestDto
    ): void {
        this.userService.updateUserSettingWithUserName({
            userId: authUser.id,
            updateUserSetting: newUserSetting
        });
    }

    @Delete(':userId(\\d+)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteUser(@Param('userId') userId: number): Promise<void> {
        await this.userService.deleteUser(userId);
    }
}
