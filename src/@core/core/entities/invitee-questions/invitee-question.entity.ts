import { QuestionInputType } from './question-input-type.enum';

export class InviteeQuestion {
    name: string;
    inputType: QuestionInputType;
    required: boolean;

    eventDetailUUID: string;
}
