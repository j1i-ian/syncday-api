import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserFetchResponseDto } from '@dto/users/user-fetch-response.dto';
import { CreateUserDto } from '../../dto/users/create-user.dto';
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
    async createUser(@Body() newUser: CreateUserDto): Promise<boolean> {
        const createdUser = await this.userService.createUser(newUser);

        return !!createdUser;
    }

    @Patch(':userId')
    async updateUser(@Param('userId') userId: number): Promise<boolean> {
        const updateSuccess = await this.userService.updateUser(userId);

        return updateSuccess;
    }

    @Delete(':userId')
    async deleteUser(@Param('userId') userId: number): Promise<boolean> {
        const deleteSuccess = await this.userService.deleteUser(userId);

        return deleteSuccess;
    }
}
