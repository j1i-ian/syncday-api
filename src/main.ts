import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);

    const PORT = 3011;
    await app.listen(PORT, () => {
        console.log(`Server is started with port ${PORT} ✨`);
    });
}
bootstrap();
