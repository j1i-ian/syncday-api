export interface LanguageInterpretation {
    enable: boolean;
    interpreters: Array<{
        email: string;
        /**
         * To request a translation from English to Chinese, enter US or CN.
         * [Docs]{@link https://developers.zoom.us/docs/api/rest/other-references/abbreviation-lists/}
         */
        languages: string;
    }>;
}
