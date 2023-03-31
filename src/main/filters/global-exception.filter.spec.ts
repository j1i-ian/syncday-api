import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
    const globalFilterException = new GlobalExceptionFilter();

    it('Global filter initialization test', () => {
        expect(globalFilterException).ok;
    });

    describe('Internal server error check', () => {
        [
            {
                description:
                    'In the case of a Korean error message, the error message must not be changed.',
                message: '영어로만 되어있는 에러 메시지일 경우 시스템의 것일 가능성이 큽니다.',
                expected: false
            },
            {
                description:
                    'If the error message is only in English, it must be properly converted.',
                message:
                    'Do not pass internal error message. It can be malformed by crackers easily.',
                expected: true
            },
            {
                description:
                    'In the case of an error message in English only, it must be properly converted.',
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
