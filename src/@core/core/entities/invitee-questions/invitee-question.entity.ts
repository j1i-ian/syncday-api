import { QuestionInputType } from './question-input-type.enum';

export class InviteeQuestion {
    name: string;
    inputType: QuestionInputType;
    required: boolean;
    answer: string | null;

    eventDetailUUID?: string;
    scheduleUUID?: string;
}
