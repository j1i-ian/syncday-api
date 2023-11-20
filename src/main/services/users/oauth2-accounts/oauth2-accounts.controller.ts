import { Controller, Get } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthUser } from '@decorators/auth-user.decorator';
import { AppJwtPayload } from '@interfaces/users/app-jwt-payload';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { OAuth2Account } from '@entity/users/oauth2-account.entity';

@Controller()
export class Oauth2AccountsController {

    constructor(
        private readonly oauth2AccountService: OAuth2AccountsService
    ) {}

    @Get()
    fetchOAuth2Accounts(
        @AuthUser() user: AppJwtPayload
    ): Observable<OAuth2Account[]> {
        return this.oauth2AccountService.find(user.id);
    }
}
