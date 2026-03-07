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
    }: { glob?: string; regex?: string; substring?: string },
): FilterSpec | undefined {
    const provided = [glob, regex, substring].filter((v) => v !== undefined);
    if (provided.length === 0) return undefined;
    if (provided.length > 1) {
        throw new Error(
            `Specify only one of --${label}, --${label}-glob, --${label}-regex, --${label}-substring`,
        );
    }
    if (regex !== undefined) return { pattern: regex, mode: 'regex' };
    if (substring !== undefined)
        return { pattern: substring, mode: 'substring' };
    return { pattern: glob as string, mode: 'glob' };
}

export function globToRegExp(glob: string): RegExp {
    const escaped = glob
        .replace(/[.+^${}()|\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
}

export function buildMatcher(filter?: FilterSpec): (value: string) => boolean {
    if (!filter) return () => true;

    if (filter.mode === 'regex') {
        const regex = new RegExp(filter.pattern);
        return (value: string) => regex.test(value);
    }
    if (filter.mode === 'substring') {
        const needle = filter.pattern;
        return (value: string) => value.includes(needle);
    }
    const regex = globToRegExp(filter.pattern);
    return (value: string) => regex.test(value);
}

export function addFilterOptions(yargs: any): any {
    return yargs
        .option('key', {
            type: 'string',
            describe: 'Filter keys by glob (default)',
        })
        .option('key-glob', {
            type: 'string',
            describe: 'Filter keys by glob (explicit)',
        })
        .option('key-regex', {
            type: 'string',
            describe: 'Filter keys by regex',
        })
        .option('key-substring', {
            type: 'string',
            describe: 'Filter keys by substring match',
        })
        .option('text', {
            type: 'string',
            describe: 'Filter translations by glob (default)',
        })
        .option('text-glob', {
            type: 'string',
            describe: 'Filter translations by glob (explicit)',
        })
        .option('text-regex', {
            type: 'string',
            describe: 'Filter translations by regex',
        })
        .option('text-substring', {
            type: 'string',
            describe: 'Filter translations by substring match',
        });
}

export function checkFilterOptions(argv: any): boolean {
    const keyGlobCount = [argv.key, argv['key-glob']].filter(
        (v) => v !== undefined,
    ).length;
    const keyRegexCount = argv['key-regex'] ? 1 : 0;
    const keySubstringCount = argv['key-substring'] ? 1 : 0;
    if (keyGlobCount + keyRegexCount + keySubstringCount > 1) {
        throw new Error(
            'Specify only one of --key/--key-glob, --key-regex, or --key-substring',
        );
    }

    const textGlobCount = [argv.text, argv['text-glob']].filter(
        (v) => v !== undefined,
    ).length;
    const textRegexCount = argv['text-regex'] ? 1 : 0;
    const textSubstringCount = argv['text-substring'] ? 1 : 0;
    if (textGlobCount + textRegexCount + textSubstringCount > 1) {
        throw new Error(
            'Specify only one of --text/--text-glob, --text-regex, or --text-substring',
        );
    }

    return true;
}

export function extractFilterOptions(argv: any): {
    keyFilter?: FilterSpec;
    textFilter?: FilterSpec;
} {
    const keyGlobValues = [argv.key, argv['key-glob']].filter(
        (v) => v !== undefined,
    ) as string[];
    const textGlobValues = [argv.text, argv['text-glob']].filter(
        (v) => v !== undefined,
    ) as string[];

    const keyFilter = resolveFilter('key', {
        glob: keyGlobValues[0],
        regex: argv['key-regex'] as string | undefined,
        substring: argv['key-substring'] as string | undefined,
    });

    const textFilter = resolveFilter('text', {
        glob: textGlobValues[0],
        regex: argv['text-regex'] as string | undefined,
        substring: argv['text-substring'] as string | undefined,
    });

    return { keyFilter, textFilter };
}
