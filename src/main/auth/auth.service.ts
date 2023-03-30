import { Injectable } from '@nestjs/common';
import { compareSync } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '@services/users/user.service';
import { User } from '@entity/users/user.entity';

@Injectable()
export class AuthService {
    constructor(
        private readonly jwtService: JwtService,

        private readonly userService: UserService
    ) {}

    async validateEmail(email: string, requestPlainPassword: string): Promise<boolean> {
        const loadedUser = await this.userService.findUserByEmail(email);

        // bcrypt compare
        const result = compareSync(requestPlainPassword, loadedUser.hashedPassword);

        return result;
    }

    issueToken(user: User): string {
        return this.jwtService.sign({
            id: user.id,
            email: user.email,
            profileImage: user.profileImage,
            name: user.nickname
        });
    }
}
