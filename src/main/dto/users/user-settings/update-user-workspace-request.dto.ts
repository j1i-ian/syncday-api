import { IsDefined } from 'class-validator';

export class PatchUserSettingRequestDto {
    @IsDefined()
    workspace: string;
}
