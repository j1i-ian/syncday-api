import { Global, Module } from '@nestjs/common';
import { CoreConvertersModule } from '@services/converters/core-converters.module';

@Global()
@Module({
    imports: [
        CoreConvertersModule
    ]
})
export class ConvertersModule {}
