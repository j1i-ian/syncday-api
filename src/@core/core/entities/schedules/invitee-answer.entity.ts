import { QuestionInputType } from '../invitee-questions/question-input-type.enum';

/**
 * @see {@link InviteeQuestion}
 */
export class InviteeAnswer {
    constructor(inviteeAnswer?: Partial<InviteeAnswer>) {
        if (inviteeAnswer) {
            Object.assign(this, inviteeAnswer);
        }
    }

    name: string;
    inputType: QuestionInputType;
    required: boolean;

    scheduleUUID: string;
}
