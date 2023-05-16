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

interface MatrixMergeOption {
    /**
     * merge all object entries. default true
     */
    array?: boolean;
}

const stringType = typeof '';
const objectType = typeof {};

/**
 * Transform matrix param to javascript object.
 *
 * @return { { matrixKey: string[], ... } }
 */
export const Matrix = createParamDecorator(
    (
        keyOrOptions: string | MatrixOption | MatrixMergeOption | null = null,
        ctx: ExecutionContext
    ) => {
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

        const matrixSearchParams = matrixParamTokens.map((_token) => new URLSearchParams(_token));

        if (keyOrOptions && (keyOrOptions as MatrixMergeOption).array === true) {
            const entries = matrixSearchParams.map((_matrixSearchParam) =>
                Object.fromEntries(_matrixSearchParam.entries())
            );
            return entries;
        }

        const matrixParam = matrixSearchParams.reduce((_matrixParam, _searchParam) => {
            const entries = _searchParam.entries();

            for (const [key, value] of entries) {
                if (_matrixParam[key]) {
                    const _matrixParamValue = _matrixParam[key];
                    _matrixParamValue.concat(value);
                    _matrixParam[key] = _matrixParamValue;
                } else {
                    _matrixParam[key] = [value];
                }
            }

            return _matrixParam;
        }, {} as ObjectEntry);

        const result = __parseByOption(matrixParam, keyOrOptions as string | MatrixOption | null);

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
