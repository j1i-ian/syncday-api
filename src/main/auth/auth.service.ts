import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
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

        let result = false;
        if (loadedUser) {
            // bcrypt compare
            result = bcrypt.compareSync(requestPlainPassword, loadedUser.hashedPassword);
        } else {
            result = false;
        }

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
