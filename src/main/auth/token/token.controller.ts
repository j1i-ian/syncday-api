import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthUser } from '@decorators/auth-user.decorator';
import { User } from '@entity/users/user.entity';
import { CreateTokenResponseDto } from '@dto/tokens/create-token-response.dto';
import { CreateGoogleUserRequestDto } from '../../dto/users/create-google-user-request.dto';
import { UserService } from '../../services/users/user.service';
import { Public } from '../strategy/jwt/public.decorator';
import { LocalAuthGuard } from '../strategy/local/local-auth.guard';
import { TokenService } from './token.service';

@Controller()
export class TokenController {
    constructor(
        private readonly tokenService: TokenService,
        private readonly userService: UserService
    ) {}

    @Post()
    @Public()
    @UseGuards(LocalAuthGuard)
    issueTokenByEmail(@AuthUser() user: User): CreateTokenResponseDto {
        return this.tokenService.issueToken(user);
    }

    @Post('google')
    @Public()
    async ensureUserSignInWithGoogle(
        @Body() createGoogleUserRequestDto: CreateGoogleUserRequestDto
    ): Promise<CreateTokenResponseDto> {
        const createTokenResponseDto = await this.tokenService.issueTokenByGoogleOAuth(
            createGoogleUserRequestDto
        );
        return createTokenResponseDto;
    }
}
