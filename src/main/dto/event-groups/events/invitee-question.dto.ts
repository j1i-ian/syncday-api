import { Expose } from 'class-transformer';
import { IsBoolean, IsDefined, IsEnum } from 'class-validator';
import { QuestionInputType } from '@entity/invitee-questions/question-input-type.enum';

export class InviteeQuestionDto {
    @IsDefined()
    @Expose()
    name: string;

    @IsDefined()
    @IsEnum(QuestionInputType)
    @Expose()
    inputType: QuestionInputType;

    @IsBoolean()
    @Expose()
    required: boolean;
}
