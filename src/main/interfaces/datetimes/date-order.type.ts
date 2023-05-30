type DateFormat = 'year' | 'month' | 'day';

type Permutations<T, U = T> = [T] extends [undefined]
    ? []
    : T extends T
        ? [T, ...Permutations<Exclude<U, T>>]
        : [];

export type DateOrder = Permutations<DateFormat>;
