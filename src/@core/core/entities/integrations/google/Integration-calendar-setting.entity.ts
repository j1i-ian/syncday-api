import { Column } from 'typeorm';

export class IntegrationCalendarSetting {
    @Column()
    readSynchronize: boolean;

    @Column()
    writeSynchronize: boolean;

    @Column()
    deleteSynchronize: boolean;
}
