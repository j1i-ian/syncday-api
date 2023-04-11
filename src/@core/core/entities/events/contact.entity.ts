import { Column } from 'typeorm';
import { ContactType } from './contact-type.enum';

export class Contact {
    @Column('enum', {
        enum: ContactType
    })
    contactType: ContactType;

    @Column()
    value: string;
}
