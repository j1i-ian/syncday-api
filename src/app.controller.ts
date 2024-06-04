import { Controller, Get } from '@nestjs/common';
import { Public } from './main/auth/strategy/jwt/public.decorator';

@Controller()
export class AppController {

    @Public()
    @Get()
    healthCheck(): string {
        return 'ok';
    }
}
