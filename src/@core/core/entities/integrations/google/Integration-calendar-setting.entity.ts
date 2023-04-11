import { Column } from 'typeorm';

/**
 * @property readSynchronize: "일정 충돌을 체크할 캘린더"에 해당되며, Free time를 확인할 캘린더임을 의미합니다.
 * @property writeSynchronize: "새 이벤트 일정을 추가할 캘린더"에 해당되며, 예약이 생성되었을 때 일정을 추가할 캘린더임을 의미합니다.
 * @property deleteSynchronize: 외부 캘린더에서 우리가 생성한 일정을 삭제한 경우, 우리 서비스에서도 삭제할 캘린더임을 의미합니다.
 */
export class IntegrationCalendarSetting {
    @Column()
    readSynchronize: boolean;

    @Column()
    writeSynchronize: boolean;

    @Column()
    deleteSynchronize: boolean;
}
