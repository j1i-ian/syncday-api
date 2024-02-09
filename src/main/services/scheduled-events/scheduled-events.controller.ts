import { Controller, Get, Query } from '@nestjs/common';
import { Observable, mergeMap, of } from 'rxjs';
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
        @AuthProfile() authProfile: AppJwtPayload
    ): Observable<ScheduledEvent[]> {

        return of(this.utilService.patchSearchOption(
            searchOptions as AppJwtPayload,
            authProfile
        )).pipe(
            mergeMap((parsedSearchOption) =>
                this.nativeScheduledEventsService.search(
                    parsedSearchOption
                ) as Observable<ScheduledEvent[]>
            )
        );
    }
}
