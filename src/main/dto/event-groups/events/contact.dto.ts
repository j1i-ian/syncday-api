import { Expose } from 'class-transformer';
import { IsEnum, IsOptional } from 'class-validator';
import { ContactType } from '@entity/events/contact-type.enum';

export class ContactDto {
    @IsEnum(ContactType)
    @Expose()
    type: ContactType;

    @IsOptional()
    @Expose()
    value: string;
}
