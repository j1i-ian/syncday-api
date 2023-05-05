import { Body, Controller, Header, Post } from '@nestjs/common';
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
    @Public()
    create(
        @Body() createVerificationDto: CreateVerificationDto,
        @BCP47AcceptLanguage() language: Language
    ): Promise<boolean> {
        const { email } = createVerificationDto;
        return this.verificationService.createVerification(email, language);
    }
}
