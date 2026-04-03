declare module 'i18n-strings-files' {
    export interface ParseOptions {
        wantComments?: boolean;
    }

    export interface StringEntry {
        text: string;
        comment?: string;
    }

    export function parse(
        input: string | Buffer,
        options?: ParseOptions,
    ): Record<string, string | StringEntry>;

    export function compile(
        input: Record<string, string | StringEntry>,
        options?: { wantComments?: boolean },
    ): string;
}
