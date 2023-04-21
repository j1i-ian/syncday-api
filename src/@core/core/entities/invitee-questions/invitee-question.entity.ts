import { QuestionInputType } from './question-input-type.enum';

export class InviteeQuestion {
    constructor(inviteeQuestion?: Partial<InviteeQuestion>) {
        if (inviteeQuestion) {
            Object.assign(this, inviteeQuestion);
        }
    }

    name: string;
    inputType: QuestionInputType;
    required: boolean;

    eventDetailUUID: string;
}
