import { BadRequestException, Injectable } from '@nestjs/common';
import { UserService } from '@services/users/user.service';
import { CreateTokenRequestDto } from '@dto/auth/create-verification-request.dto';
import { CreateTokenResponseDto } from '@dto/auth/tokens/create-token-response.dto';
import { TokenService } from './token/token.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly tokenService: TokenService,

        private readonly userService: UserService
    ) {}

    async authorizeUserByEmail(
        createTokenRequestDto: CreateTokenRequestDto
    ): Promise<CreateTokenResponseDto> {
        const loadedUser = await this.userService.findUserByEmail(createTokenRequestDto.email);

        if (loadedUser) {
            const issuedTokenResponseDto = this.tokenService.issueToken(loadedUser);
            return issuedTokenResponseDto;
        } else {
            throw new BadRequestException('Member does not exist. Please sign up as member');
        }
    }
}
