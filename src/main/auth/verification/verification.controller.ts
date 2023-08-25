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
    async create(
        @Body() createVerificationDto: CreateVerificationDto,
        @BCP47AcceptLanguage() language: Language
    ): Promise<boolean> {

        let isValid = this.verificationService.validateCreateVerificationDto(createVerificationDto);

        if (isValid) {
            isValid = await this.verificationService.createVerification(createVerificationDto, language);
        }

        return isValid;
    }
}
