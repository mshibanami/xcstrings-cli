export type FilterMode = 'glob' | 'regex' | 'substring';

export interface FilterSpec {
    pattern: string;
    mode: FilterMode;
}

export function resolveFilter(
    label: 'key' | 'text',
    {
        glob,
        regex,
        substring,
    }: { glob?: string; regex?: string; substring?: string }
): FilterSpec | undefined {
    const provided = [glob, regex, substring].filter((v) => v !== undefined);
    if (provided.length === 0) return undefined;
    if (provided.length > 1) {
        throw new Error(`Specify only one of --${label}, --${label}-glob, --${label}-regex, --${label}-substring`);
    }
    if (regex !== undefined) return { pattern: regex, mode: 'regex' };
    if (substring !== undefined) return { pattern: substring, mode: 'substring' };
    return { pattern: glob as string, mode: 'glob' };
}
