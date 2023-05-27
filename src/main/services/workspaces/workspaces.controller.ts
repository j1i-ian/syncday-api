import { Controller, Get, Header, Query } from '@nestjs/common';
import { SyncdayRedisService } from '../syncday-redis/syncday-redis.service';

@Controller()
export class WorkspacesController {
    constructor(private readonly syncdayRedisService: SyncdayRedisService) {}

    @Get()
    @Header('Content-type', 'application/json')
    async getWorkspaceStatus(@Query('workspace') desireWorkspace: string): Promise<boolean> {
        const isAlreadyUsed = await this.syncdayRedisService.getWorkspaceStatus(desireWorkspace);
        return isAlreadyUsed;
    }
}
