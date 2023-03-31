import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from '@entity/users/user.entity';
import { Role } from '@entity/users/role.enum';
import { CreateUserRequestDto } from '@dto/users/create-user-request.dto';
import { TokenService } from '../../auth/token/token.service';

@Injectable()
export class UserService {
    constructor(
        private readonly tokenService: TokenService,
        @InjectRepository(User) private readonly userRepository: Repository<User>
    ) {}

    async findUserById(userId: number): Promise<User> {
        const loadedUser = await this.userRepository.findOneByOrFail({ id: userId });

        return loadedUser;
    }

    async findUserByEmail(email: string): Promise<User | null> {
        const loadedUser = await this.userRepository.findOneBy({ email });

        return loadedUser;
    }

    async validateEmailAndPassword(
        email: string,
        requestPlainPassword: string
    ): Promise<User | null> {
        const loadedUser = await this.findUserByEmail(email);

        let result = false;
        if (loadedUser) {
            result = await this.tokenService.comparePassword(
                requestPlainPassword,
                loadedUser.hashedPassword
            );
        } else {
            result = false;
        }

        return result ? loadedUser : null;
    }

    async createUser(newUser: CreateUserRequestDto): Promise<User> {
        const alreadySignedUser = await this.findUserByEmail(newUser.email);

        if (alreadySignedUser) {
            throw new BadRequestException('Already signed up email.');
        }

        const createdUser = this.userRepository.create(newUser);

        const salt = await bcrypt.genSalt(5);
        const hashedPassword = await bcrypt.hash(newUser.plainPassword, salt);

        const savedUser = await this.userRepository.save({
            ...createdUser,
            hashedPassword,
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
