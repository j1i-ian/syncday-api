import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@entity/users/user.entity';

@Injectable()
export class UserService {
    constructor(@InjectRepository(User) private readonly userRepository: Repository<User>) {}

    async findUserById(userId: number): Promise<User> {
        const loadedUser = await this.userRepository.findOneByOrFail({ id: userId });

        return loadedUser;
    }

    async findUserByEmail(email: string): Promise<User> {
        const loadedUser = await this.userRepository.findOneByOrFail({ email });

        return loadedUser;
    }
}
