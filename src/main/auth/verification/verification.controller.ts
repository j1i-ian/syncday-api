import { Body, Controller, Header, Post } from '@nestjs/common';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { CreateVerificationDto } from '@dto/verifications/create-verification.dto';
import { Language } from '@app/enums/language.enum';
import { BCP47AcceptLanguage } from '../../decorators/accept-language.decorator';
import { Public } from '../strategy/jwt/public.decorator';
import { VerificationService } from './verification.service';

@Controller()
export class VerificationController {
    constructor(private readonly verificationService: VerificationService) {}

    @Post()
    @Header('Content-type', 'application/json')
    @Public({ ignoreInvalidJwtToken: false })
    async create(
        @Body() createVerificationDto: CreateVerificationDto,
        @AuthProfile('userUUID') userUUID: string,
        @BCP47AcceptLanguage() language: Language
    ): Promise<boolean> {

        let isValid = this.verificationService.validateCreateVerificationDto(createVerificationDto, userUUID);

        if (isValid) {

            createVerificationDto.uuid = userUUID ?? createVerificationDto.uuid;
            const isSignUpVerification = userUUID ? true : false;

            isValid = await this.verificationService.createVerification(createVerificationDto, language, isSignUpVerification);
        }

        return isValid;
    }
}
