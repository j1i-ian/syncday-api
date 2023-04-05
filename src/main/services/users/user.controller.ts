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
import { CreateGoogleUserRequestDto } from '../../dto/users/create-google-user-request.dto';
import { TokenService } from '../../../main/auth/token/token.service';
import { UserService } from './user.service';
import { GoogleToken } from '../integrations/interfaces/issue-google-token.interface';
@Controller()
export class UserController {
    constructor(
        private readonly userService: UserService,
        private readonly tokenService: TokenService
    ) {}

    @Get(':userId')
    async fetchMyInfo(@Param('userId') userId: number): Promise<UserFetchResponseDto> {
        const loadedUser = await this.userService.findUserById(userId);

        return loadedUser;
    }

    @Post()
    @Public()
    async createUser(@Body() newUser: CreateUserRequestDto): Promise<CreateUserResponseDto> {
        const createdUser = await this.userService.createUser(newUser);

        return plainToInstance(CreateUserResponseDto, createdUser as CreateUserResponseDto, {
            excludeExtraneousValues: true
        });
    }

    @Post('google')
    @Public()
    async loginOrCreateGoogleUser(
        @Body() newUser: CreateGoogleUserRequestDto
    ): Promise<GoogleToken> {
        /**
         * TODO: Separate user creation and token issuance later to separate context
         */
        const googleUser = await this.userService.getOrCreateGoogleUser(newUser);
        const token = this.tokenService.issueToken(googleUser);
        return token;
    }

    @Patch(':userId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async updateUser(@Param('userId') userId: number): Promise<void> {
        await this.userService.updateUser(userId);
    }

    @Delete(':userId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteUser(@Param('userId') userId: number): Promise<void> {
        await this.userService.deleteUser(userId);
    }
}
