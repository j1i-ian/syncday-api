import { createParamDecorator, ExecutionContext } from '@nestjs/common';
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

        const consistedMap = matrixParamTokens.reduce((_map, token) => {
            const [tokenKey, tokenValue] = token.split('=');
            const previousValue: string[] = _map.get(tokenKey) ?? [];

            _map.set(tokenKey, previousValue.concat(tokenValue));

            return _map;
        }, new Map<string, string[]>());

        const matrixParam = Object.fromEntries(consistedMap.entries());
        const result = __parseByOption(matrixParam, keyOrOptions);

        return result;
    }
);

const __isMatrixParamUseHttpMethod = (httpMethod: AdditionalHttpMethod): boolean => {
    let shouldTransform = false;

    switch (httpMethod) {
        case AdditionalHttpMethod.LINK:
        case AdditionalHttpMethod.UNLINK:
            shouldTransform = true;
            break;
        default:
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
