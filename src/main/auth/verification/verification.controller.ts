import { Body, Controller, Header, Patch, Post } from '@nestjs/common';
import { AuthUser } from '@decorators/auth-user.decorator';
import { UpdateVerificationDto } from '@dto/verifications/update-verification.dto';
import { Language } from '@app/enums/language.enum';
import { BCP47AcceptLanguage } from '../../decorators/accept-language.decorator';
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
        @BCP47AcceptLanguage() language: Language
    ): Promise<boolean> {
        return this.verificationService.createVerification(authUser, language);
    }

    /**
     * Verification is processed with email of user.
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
