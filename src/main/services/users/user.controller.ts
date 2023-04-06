import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { CreateUserResponseDto } from '@dto/users/create-user-response.dto';
import { UserFetchResponseDto } from '@dto/users/user-fetch-response.dto';
import { Public } from '../../auth/strategy/jwt/public.decorator';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { AppJwtPayload } from '../../auth/strategy/jwt/app-jwt-payload.interface';
import { UpdateUserSettingRequestDto } from '../../dto/users/update-user-setting-request.dto';
import { BCP47AcceptLanguage } from '../../decorators/accept-language.decorator';
import { Language } from '../../enums/language.enum';
import { UserService } from './user.service';
@Controller()
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get(':userId(\\d)')
    async fetchMyInfo(@Param('userId') userId: number): Promise<UserFetchResponseDto> {
        const loadedUser = await this.userService.findUserById(userId);

        return loadedUser;
    }

    @Post()
    @Public()
    async createUser(
        @Body() newUser: CreateUserRequestDto,
        @BCP47AcceptLanguage() language: Language
    ): Promise<CreateUserResponseDto> {
        const createdUser = await this.userService.createUser(newUser, language);

        return plainToInstance(CreateUserResponseDto, createdUser as CreateUserResponseDto, {
            excludeExtraneousValues: true
        });
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
