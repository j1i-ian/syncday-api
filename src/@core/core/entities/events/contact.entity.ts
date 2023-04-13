import { Column } from 'typeorm';
import { ContactType } from './contact-type.enum';

export class Contact {
    constructor(contact?: Partial<Contact>) {
        if (contact) {
            Object.assign(this, contact);
        }
    }

    @Column('enum', {
        enum: ContactType
    })
    contactType: ContactType;

    @Column()
    value: string;
}
