import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
    const globalFilterException = new GlobalExceptionFilter();

    it('전역 필터 초기화 테스트', () => {
        expect(globalFilterException).ok;
    });

    describe('내부 서버 에러 체크', () => {
        [
            {
                description: '한글 에러 메시지일 경우 에러 메시지가 바뀌면 안 된다.',
                message: '영어로만 되어있는 에러 메시지일 경우 시스템의 것일 가능성이 큽니다.',
                expected: false
            },
            {
                description: '한글을 포함한 영문 에러 메시지일 경우 적절하게 변환되어야한다.',
                message:
                    'global exception: EntityNotFoundError: Could not find any entity of type "User" matching: {\n    "nickname": "모어모발"\n}',
                expected: true
            },
            {
                description: '영문만으로 되어있는 에러 메시지일 경우 적절하게 변환되어야한다.',
                message:
                    'Do not pass internal error message. It can be malformed by crackers easily.',
                expected: true
            },
            {
                description: '영문만으로 되어있는 에러 메시지일 경우 적절하게 변환되어야한다.',
                message: '요청변수가 적합하지 않습니다.(query - 주소를 상세히 입력해 주십시오.)',
                expected: false
            }
        ].forEach(({ description, message, expected }) => {
            it(description, () => {
                const result = globalFilterException.isInternalErrorEnglishMessage(message);

                expect(result).equals(expected);
            });
        });
    });
});
