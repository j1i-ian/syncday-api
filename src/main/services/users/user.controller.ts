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
import { UserService } from './user.service';

@Controller()
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get(':userId')
    async fetchMyInfo(@Param('userId') userId: number): Promise<UserFetchResponseDto> {
        const loadedUser = await this.userService.findUserById(userId);

        return loadedUser;
    }

    @Post()
    async createUser(@Body() newUser: CreateUserRequestDto): Promise<CreateUserResponseDto> {
        const createdUser = await this.userService.createUser(newUser);

        return plainToInstance(CreateUserResponseDto, {
            ...createdUser
        } as CreateUserResponseDto);
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
