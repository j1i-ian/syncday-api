import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { CoreGoogleConverterService } from '@services/converters/google/core-google-converter.service';

@Injectable()
export class LogSubscriberService implements OnModuleInit {

    constructor(
        private readonly coreGoogleConverterService: CoreGoogleConverterService,
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
    ) {}

    onModuleInit(): void {

        this.coreGoogleConverterService.errors$
            .subscribe((error) => {
                this.logger.error(error);
            });
    }
}
