declare module 'i18n-strings-files' {
    export interface ParseOptions {
        wantsComments?: boolean;
    }

    export interface StringsDict {
        [key: string]: string | { text: string; comment?: string };
    }

    export function parse(
        input: string | Buffer,
        options?: ParseOptions,
    ): StringsDict;
    export function readFileSync(
        filename: string,
        options?: string | (ParseOptions & { encoding?: string }),
    ): StringsDict;
}
