import { BadRequestException } from '@nestjs/common';
import { ValidateQueryParamPipe } from './validate-query-param.pipe';

describe('ValidateQueryParamPipe', () => {

    const pipe = new ValidateQueryParamPipe();

    it('should be defined', () => {
        expect(pipe).ok;
    });

    it('should be pass a normal string', () => {

        const result = pipe.transform('queryParamValue');

        expect(result).ok;
    });

    it('should be threw error when undefined string is given', () => {
        expect(() => pipe.transform('undefined')).throws(BadRequestException);
    });

    it('should be threw error when undefined is given', () => {
        expect(() => pipe.transform()).throws(BadRequestException);
    });

    it('should be threw error when empty string is given', () => {
        expect(() => pipe.transform()).throws(BadRequestException);
    });
});
