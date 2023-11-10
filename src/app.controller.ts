import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
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

    @Public()
    @Get('database')
    async databaseHealthCheck(): Promise<string> {

        // mariadb @@global.connect_timeout is 10
        const timeoutCheck = await Promise.race([
            new Promise((resolve) => setTimeout(() => resolve('timeout'), 1000)),
            this.datasource.query('SELECT 1')
        ]);

        if (timeoutCheck.length === 1 && timeoutCheck[0]['1'] === 1) {
            return 'ok';
        } else {
            throw new InternalServerErrorException('database health check is failed');
        }
    }
}
