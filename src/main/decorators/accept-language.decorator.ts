import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import resolveAcceptLanguage from 'resolve-accept-language';
import { Language } from '../enums/language.enum';

export const BCP47AcceptLanguage = createParamDecorator(
    (_data: string, ctx: ExecutionContext): Language => {
        const request = ctx.switchToHttp().getRequest();

        const acceptLanguageHeader = (request.headers['accept-language'] as string) || '';

        const language = resolveAcceptLanguage(
            acceptLanguageHeader,
            Object.values(Language),
            Language.ENGLISH
        ) as Language;

        return language;
    }
);
