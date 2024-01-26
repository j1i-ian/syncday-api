import { Controller, Get } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { OAuth2AccountsService } from '@services/users/oauth2-accounts/oauth2-accounts.service';
import { OAuth2Account } from '@entities/users/oauth2-account.entity';

@Controller()
export class OAuth2AccountsController {

    constructor(
        private readonly oauth2AccountService: OAuth2AccountsService
    ) {}

    @Get()
    fetchOAuth2Accounts(
        @AuthProfile('userId') userId: number
    ): Observable<OAuth2Account[]> {
        return this.oauth2AccountService.find(userId);
    }
}
