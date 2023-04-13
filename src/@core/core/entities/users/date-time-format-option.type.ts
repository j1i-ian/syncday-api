export type DateTimeFormatOption = Omit<
    Intl.DateTimeFormatOptions,
    'localeMatcher' | 'formatMatcher'
>;
