import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Observable, catchError, defer, forkJoin, from, mergeMap, of } from 'rxjs';
import { PublicDecoratorOptions } from './public-decorator-options.interface';
import { PUBLIC_SETTING_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
    public constructor(private readonly reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext): Observable<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const bearerToken$ = of(request?.headers?.authorization);

        const publicSetting$ = of(
            this.reflector.getAllAndOverride<boolean>(PUBLIC_SETTING_KEY, [
                context.getHandler(),
                context.getClass()
            ]) as unknown as PublicDecoratorOptions
        );

        return forkJoin({
            bearerToken: bearerToken$,
            publicSetting: publicSetting$
        }).pipe(
            mergeMap(({ bearerToken, publicSetting }) => {

                const canActive$ = defer(() => from(super.canActivate(context) as Promise<boolean>))
                    .pipe(
                        catchError((error) => {
                            if (!!publicSetting?.ignoreInvalidJwtToken === false) {
                                throw error;
                            } else {
                                return of(true);
                            }
                        })
                    );

                return bearerToken ? canActive$ : of(!!publicSetting);
            })
        );
    }
}
