import { QuestionInputType } from '../invitee-questions/question-input-type.enum';

/**
 * @see {@link InviteeQuestion}
 */
export class InviteeAnswer {
    name: string;
    inputType: QuestionInputType;
    required: boolean;

    scheduleUUID: string;
}
