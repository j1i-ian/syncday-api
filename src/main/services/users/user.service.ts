import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@entity/users/user.entity';
import { Role } from '@entity/users/role.enum';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';

@Injectable()
export class UserService {
    constructor(@InjectRepository(User) private readonly userRepository: Repository<User>) {}

    async findUserById(userId: number): Promise<User> {
        const loadedUser = await this.userRepository.findOneByOrFail({ id: userId });

        return loadedUser;
    }

    async findUserByEmail(email: string): Promise<User | null> {
        const loadedUser = await this.userRepository.findOneBy({ email });

        return loadedUser;
    }

    async createUser(newUser: CreateUserRequestDto): Promise<User> {
        const alreadySignedUser = await this.findUserByEmail(newUser.email);

        if (alreadySignedUser) {
            throw new BadRequestException('Already signed up email.');
        }

        const createdUser = this.userRepository.create(newUser);

        const savedUser = await this.userRepository.save({
            ...createdUser,
            roles: [Role.NORMAL]
        });

        return savedUser;
    }

    async updateUser(userId: number): Promise<boolean> {
        return await Promise.resolve(!!userId);
    }

    async deleteUser(userId: number): Promise<boolean> {
        return await Promise.resolve(!!userId);
    }
}
