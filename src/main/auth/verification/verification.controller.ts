import { Body, Controller, Get, Header, Param, Patch, Post } from '@nestjs/common';
import { UpdateVerificationDto } from '@dto/verifications/update-verification.dto';
import { Language } from '@app/enums/language.enum';
import { BCP47AcceptLanguage } from '../../decorators/accept-language.decorator';
import { CreateVerificationDto } from '../../dto/verifications/create-verification.dto';
import { Public } from '../strategy/jwt/public.decorator';
import { VerificationService } from './verification.service';

@Controller()
export class VerificationController {
    constructor(private readonly verificationService: VerificationService) {}

    @Get(':workspace')
    @Header('Content-type', 'application/json')
    fetchUserCustomPath(@Param('workspace') workspace: string): Promise<boolean> {
        const workspaceStatus = this.verificationService.fetchUserWorkspaceStatus(workspace);

        return workspaceStatus;
    }

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
