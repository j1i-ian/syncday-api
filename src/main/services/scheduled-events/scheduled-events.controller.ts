import { Controller, Get, Query } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthProfile } from '@decorators/auth-profile.decorator';
import { ScheduledEventSearchOption } from '@interfaces/scheduled-events/scheduled-event-search-option.type';
import { AppJwtPayload } from '@interfaces/profiles/app-jwt-payload';
import { UtilService } from '@services/util/util.service';
import { NativeScheduledEventsService } from '@services/scheduled-events/native-scheduled-events.service';
import { ScheduledEvent } from '@entity/scheduled-events/scheduled-event.entity';

@Controller()
export class ScheduledEventsController {

    constructor(
        private readonly nativeScheduledEventsService: NativeScheduledEventsService,
        private readonly utilService: UtilService
    ) {}

    @Get()
    search(
        @Query() searchOptions: Partial<ScheduledEventSearchOption>,
        @Query('page') page = 0,
        @Query('take') take = 6,
        @AuthProfile() authProfile: AppJwtPayload
    ): Observable<ScheduledEvent[]> {

        const parsedSearchOption = this.utilService.patchSearchOption(
            searchOptions as AppJwtPayload,
            authProfile
        );

        return this.nativeScheduledEventsService.search({
            page,
            take,
            profileId: parsedSearchOption.id,
            hostUUID: parsedSearchOption.uuid,
            orderScheduledTimeStartTimestamp: searchOptions.orderScheduledTimeStartTimestamp,
            ...parsedSearchOption
        }) as Observable<ScheduledEvent[]>;
    }
}
