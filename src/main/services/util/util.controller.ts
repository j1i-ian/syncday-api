import { Body, Controller, Header, Post } from '@nestjs/common';
import { FileUtilsService } from '@services/util/file-utils/file-utils.service';

@Controller()
export class UtilController {
    constructor(
        private readonly fileUtilsService : FileUtilsService
    ) {}

    @Post('presigned')
    @Header('Content-type', 'text/plain')
    issuePresignedUrl(
        @Body() { filename }: { filename: string }
    ): Promise<string> {
        return this.fileUtilsService.issuePresignedUrl(filename);
    }
}
