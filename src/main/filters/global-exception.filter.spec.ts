import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
    const globalFilterException = new GlobalExceptionFilter();

    it('Global filter initialization test', () => {
        expect(globalFilterException).ok;
    });
});
