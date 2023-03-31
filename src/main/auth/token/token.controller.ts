import { Controller, Post, UseGuards } from '@nestjs/common';
import { User } from '../../../@core/core/entities/users/user.entity';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { CreateTokenResponseDto } from '../../dto/tokens/create-token-response.dto';
import { LocalAuthGuard } from '../strategy/local/local-auth.guard';
import { TokenService } from './token.service';

@Controller()
export class TokenController {
    constructor(private readonly tokenService: TokenService) {}

    @Post()
    @UseGuards(LocalAuthGuard)
    issueTokenByEmail(@AuthUser() user: User): CreateTokenResponseDto {
        return this.tokenService.issueToken(user);
    }
}
