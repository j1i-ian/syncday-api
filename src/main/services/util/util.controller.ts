import { Body, Controller, Post } from '@nestjs/common';
import { FileUtilsService } from '@services/util/file-utils/file-utils.service';

@Controller()
export class UtilController {
    constructor(
        private readonly fileUtilsService : FileUtilsService
    ) {}

    @Post('presigned')
    issuePresignedUrl(
        @Body() { filename }: { filename: string }
    ): Promise<string> {
        const presignedUrl = this.fileUtilsService.issuePresignedUrl(filename);

        return presignedUrl;
    }
}
