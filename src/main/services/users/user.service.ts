import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@entity/users/user.entity';
import { CreateUserDto } from '@dto/users/create-user.dto';

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

    async createUser(newUser: CreateUserDto): Promise<User> {
        return await Promise.resolve(newUser as unknown as User);
    }

    async updateUser(userId: number): Promise<boolean> {
        return await Promise.resolve(!!userId);
    }

    async deleteUser(userId: number): Promise<boolean> {
        return await Promise.resolve(!!userId);
    }
}
