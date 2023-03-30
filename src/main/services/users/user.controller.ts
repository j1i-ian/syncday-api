import { UserFetchResponseDto } from '@dto/users/user-fetch-response.dto';
import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get(':userId')
    async fetchMyInfo(@Param('userId') userId: number): Promise<UserFetchResponseDto> {
        const loadedUser = await this.userService.findUserById(userId);

        return loadedUser;
    }
}
