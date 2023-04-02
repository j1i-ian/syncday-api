import { Body, Controller, Header, Headers, Patch, Post } from '@nestjs/common';
import resolveAcceptLanguage from 'resolve-accept-language';
import { AuthUser } from '@decorators/auth-user.decorator';
import { UpdateVerificationDto } from '@dto/verifications/update-verification.dto';
import { Language } from '@app/enums/language.enum';
import { AppJwtPayload } from '../strategy/jwt/app-jwt-payload.interface';
import { Public } from '../strategy/jwt/public.decorator';
import { VerificationService } from './verification.service';

@Controller()
export class VerificationController {
    constructor(private readonly verificationService: VerificationService) {}

    @Post()
    @Header('Content-type', 'application/json')
    create(
        @AuthUser() authUser: AppJwtPayload,
        @Headers('Accept-Language') acceptLanguageHeader: string
    ): Promise<boolean> {
        const language = resolveAcceptLanguage(
            acceptLanguageHeader,
            Object.values(Language),
            Language.ENGLISH
        ) as Language;

        return this.verificationService.createVerification(authUser, language);
    }

    /**
     * Verification is processed with email through user email.
     * So when user loaded then rendered page would send ajax
     * transmission to this api only with auth code.
     * Therefore this api should be public.
     *
     * @param id issued verification id
     * @param updateVerificationDto
     * @returns
     */
    @Patch()
    @Public()
    @Header('Content-type', 'application/json')
    update(@Body() updateVerificationDto: UpdateVerificationDto): Promise<boolean> {
        const { email, verificationCode } = updateVerificationDto;
        return this.verificationService.updateVerificationByEmail(email, verificationCode);
    }
}
