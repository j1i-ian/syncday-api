import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from './main/auth/strategy/jwt/public.decorator';

@Controller()
export class AppController {

    constructor(
        @InjectDataSource() private readonly datasource: DataSource
    ) {}

    @Public()
    @Get()
    healthCheck(): string {
        return 'ok';
    }
}
