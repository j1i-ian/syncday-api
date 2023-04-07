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
import { UserFetchResponseDto } from '@dto/users/user-fetch-response.dto';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { AppJwtPayload } from '../../auth/strategy/jwt/app-jwt-payload.interface';
import { UpdateUserSettingRequestDto } from '../../dto/users/update-user-setting-request.dto';
import { Public } from '../../auth/strategy/jwt/public.decorator';
import { UpdateVerificationDto } from '../../dto/verifications/update-verification.dto';
import { UserService } from './user.service';
@Controller()
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get(':userId(\\d)')
    async fetchMyInfo(@Param('userId') userId: number): Promise<UserFetchResponseDto> {
        const loadedUser = await this.userService.findUserById(userId);

        return loadedUser;
    }

    /**
     * Verification is processed with email of user.
     * So when user loaded then rendered page would send ajax
     * transmission to this api only with auth code.
     * Therefore this api should be public.
     *
     * @param id issued verification id
     * @param updateVerificationDto
     * @returns
     */
    @Post()
    @Public()
    @Header('Content-type', 'application/json')
    update(@Body() updateVerificationDto: UpdateVerificationDto): Promise<boolean> {
        const { email, verificationCode } = updateVerificationDto;
        return this.userService.updateVerificationByEmail(email, verificationCode);
    }

    @Patch()
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

    @Delete(':userId(\\d)')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteUser(@Param('userId') userId: number): Promise<void> {
        await this.userService.deleteUser(userId);
    }
}
