import { HttpException } from '@nestjs/common';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';

export interface AuthProfileOption {
    property: keyof AppJwtPayload | null;
    nullCheck: boolean;
    nullCheckException: HttpException;
}
