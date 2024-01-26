import { Body, Controller, Post } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CreateTemporaryUserRequestDto } from '@dto/users/create-temporary-user-request.dto';
import { CreateTemporaryUserResponseDto } from '@dto/users/create-temporary-user-response.dto';
import { Public } from '../../../auth/strategies/jwt/public.decorator';
import { BCP47AcceptLanguage } from '../../../decorators/accept-language.decorator';
import { Language } from '../../../enums/language.enum';
import { TemporaryUsersService } from './temporary-users.service';

@Controller()
export class TemporaryUsersController {
    constructor(private readonly temporaryUsersService: TemporaryUsersService) {}

    @Post()
    @Public()
    async createTemporaryUser(
        @Body() newUser: CreateTemporaryUserRequestDto,
        @BCP47AcceptLanguage() language: Language
    ): Promise<CreateTemporaryUserResponseDto> {
        const createdTempUser = await this.temporaryUsersService.createTemporaryUser(
            newUser,
            language
        );

        return plainToInstance(
            CreateTemporaryUserResponseDto,
            createdTempUser as CreateTemporaryUserResponseDto,
            {
                excludeExtraneousValues: true
            }
        );
    }
}
