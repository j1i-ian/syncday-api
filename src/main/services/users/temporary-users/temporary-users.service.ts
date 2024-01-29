import { Injectable } from '@nestjs/common';
import { TemporaryUser } from '@entity/users/temporary-user.entity';
import { CreateTemporaryUserRequestDto } from '@dto/users/create-temporary-user-request.dto';
import { SyncdayRedisService } from '../../syncday-redis/syncday-redis.service';
import { Language } from '../../../enums/language.enum';

@Injectable()
export class TemporaryUsersService {
    constructor(
        private readonly syncdayRedisService: SyncdayRedisService
    ) {}

    async createTemporaryUser(
        newUser: CreateTemporaryUserRequestDto,
        language: Language
    ): Promise<TemporaryUser | null> {
        const temporaryUser = new TemporaryUser({
            ...newUser,
            language
        });

        const success = await this.syncdayRedisService.saveTemporaryUser(temporaryUser);

        return success ? temporaryUser : null;
    }
}
