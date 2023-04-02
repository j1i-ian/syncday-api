/* eslint-disable import/no-internal-modules */
import { Inject } from '@nestjs/common';
import { DEFAULT_CLUSTER_NAMESPACE, getClusterToken } from '@liaoliaots/nestjs-redis';
import { namespaces } from '@liaoliaots/nestjs-redis/dist/cluster/common';

type NestJSInjectReturnType = (
    target: object,
    key: string | symbol | undefined,
    index?: number
) => void;

/**
 * TODO: Resolve type error in library.
 * `InjectCluster` decorator type in library has fake type error on typescript.
 * ParameterDecorator conflicts with namespace param type.
 */
export const AppInjectCluster = (namespace = DEFAULT_CLUSTER_NAMESPACE): NestJSInjectReturnType => {
    const token = getClusterToken(namespace);
    namespaces.set(namespace, token);
    return Inject(token);
};
