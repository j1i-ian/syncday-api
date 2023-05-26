import { URLSearchParams } from 'url';
import { createParamDecorator, ExecutionContext, RequestMethod } from '@nestjs/common';
import { Request } from 'express';
import { AdditionalHttpMethod } from '@app/enums/additional-http-method.enum';

interface ObjectEntry {
    [k: string]: string[];
}

/**
 * Matrix Option
 */
interface MatrixOption {
    /**
     * Return matrix element that is only matched with key
     *
     * @requires
     */
    key: string;

    /**
     * Parse all elements to integers.
     *
     * @example ['1', '2'] -> [1, 2]
     */
    parseInt?: boolean | undefined;

    /**
     * Only return the first element of matrix field of key.
     */
    firstOne?: boolean | undefined;
}

const stringType = typeof '';
const objectType = typeof {};

/**
 * Transform matrix param to javascript object.
 *
 * @return { { matrixKey: string[], ... } }
 */
export const Matrix = createParamDecorator(
    (keyOrOptions: string | MatrixOption | null = null, ctx: ExecutionContext) => {
        if (
            __isMatrixParamUseHttpMethod(
                ctx.switchToHttp().getRequest().method as AdditionalHttpMethod
            ) === false
        ) {
            return;
        }

        const request: Request = ctx.switchToHttp().getRequest();
        const matrixParamTokens = request.path.split(';');

        matrixParamTokens.shift(); // skip url

        if (matrixParamTokens.length <= 0) {
            return;
        }

        const matrixSearchParams = matrixParamTokens.map((_token) => new URLSearchParams(_token));

        const matrixParam = matrixSearchParams.reduce((_matrixParam, _searchParam) => {
            const entries = _searchParam.entries();

            for (const [key, value] of entries) {
                if (_matrixParam[key]) {
                    const _matrixParamValue = _matrixParam[key];
                    _matrixParamValue.push(value);
                    _matrixParam[key] = _matrixParamValue;
                } else {
                    _matrixParam[key] = [value];
                }
            }

            return _matrixParam;
        }, {} as ObjectEntry);

        const result = __parseByOption(matrixParam, keyOrOptions);

        return result;
    }
);

const __isMatrixParamUseHttpMethod = (
    httpMethod: RequestMethod | AdditionalHttpMethod
): boolean => {
    let shouldTransform = false;

    switch (httpMethod) {
        case AdditionalHttpMethod.LINK:
        case AdditionalHttpMethod.UNLINK:
        case RequestMethod[RequestMethod.PATCH]:
            shouldTransform = true;
            break;
        default:
        case AdditionalHttpMethod.COPY:
            shouldTransform = false;
    }
    return shouldTransform;
};
const __parseByOption = (
    matrixParam: ObjectEntry,
    keyOrOptions: string | MatrixOption | null
): string | number | string[] | number[] | ObjectEntry => {
    if (keyOrOptions === null || !keyOrOptions) {
        return matrixParam;
    }

    const isKeyString = typeof keyOrOptions === stringType;
    const isOptionObject = typeof keyOrOptions === objectType;

    let result: string | number | string[] | number[] | ObjectEntry;

    if (isKeyString) {
        // key option
        result = matrixParam[keyOrOptions as string];
    } else if (isOptionObject) {
        // multi option

        const { key, parseInt, firstOne } = keyOrOptions as MatrixOption;
        result = matrixParam[key];
        result = parseInt ? result.map((_resultToken) => +_resultToken) : result;
        result = firstOne ? result[0] : result;
    } else {
        result = matrixParam;
    }

    return result;
};
