import { Body, Controller, Header, Post, Put } from '@nestjs/common';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { CreateVerificationDto } from '@dto/verifications/create-verification.dto';
import { UpdatePhoneWithVerificationDto } from '@dto/verifications/update-phone-with-verification.dto';
import { Language } from '@app/enums/language.enum';
import { BCP47AcceptLanguage } from '../../decorators/accept-language.decorator';
import { Public } from '../strategies/jwt/public.decorator';
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

    @Put()
    @Header('Content-type', 'application/json')
    @Public({ ignoreInvalidJwtToken: false })
    async update(
        @Body() updateVerificationDto: UpdatePhoneWithVerificationDto,
        @AuthProfile('userUUID') userUUID?: string | null
    ): Promise<boolean> {

        const isUUIDValid = userUUID ? !!userUUID : !!updateVerificationDto.uuid;
        const isValid = updateVerificationDto.phone && updateVerificationDto.verificationCode && isUUIDValid;

        let updateSuccess = false;

        if (isValid) {
            updateVerificationDto.uuid = userUUID ?? updateVerificationDto.uuid;
            updateSuccess = await this.verificationService.update(updateVerificationDto);
        }

        return updateSuccess;
    }
}
