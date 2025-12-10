import Mustache from 'mustache';
import { readXCStrings } from './_shared';
import { CommandModule } from 'yargs';
import { resolveFilter } from '../utils/filters.js';

export type FilterMode = 'glob' | 'regex' | 'substring';

export interface FilterSpec {
    pattern: string;
    mode: FilterMode;
}

export interface ListOptions {
    path: string;
    languages?: string[];
    keyFilter?: FilterSpec;
    textFilter?: FilterSpec;
    format?: string;
}

export function createStringsCommand(): CommandModule {
    return {
        command: 'strings',
        describe: 'List strings in the xcstrings file',
        builder: (yargs) => yargs
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
            })
            .option('languages', {
                type: 'string',
                array: true,
                alias: 'l',
                describe: 'Include only these languages',
            })
            .option('format', {
                type: 'string',
                describe: 'Mustache template. Available variables: {{language}}, {{key}}, {{text}}',
            })
            .check((argv) => {
                const keyGlobCount = [argv.key, argv['key-glob']].filter((v) => v !== undefined).length;
                const keyRegexCount = argv['key-regex'] ? 1 : 0;
                const keySubstringCount = argv['key-substring'] ? 1 : 0;
                if (keyGlobCount + keyRegexCount + keySubstringCount > 1) {
                    throw new Error('Specify only one of --key/--key-glob, --key-regex, or --key-substring');
                }

                const textGlobCount = [argv.text, argv['text-glob']].filter((v) => v !== undefined).length;
                const textRegexCount = argv['text-regex'] ? 1 : 0;
                const textSubstringCount = argv['text-substring'] ? 1 : 0;
                if (textGlobCount + textRegexCount + textSubstringCount > 1) {
                    throw new Error('Specify only one of --text/--text-glob, --text-regex, or --text-substring');
                }

                return true;
            }),
        handler: async (argv) => {
            const keyGlobValues = [argv.key, argv['key-glob']].filter((v) => v !== undefined) as string[];
            const textGlobValues = [argv.text, argv['text-glob']].filter((v) => v !== undefined) as string[];

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

            const output = await list({
                path: argv.path as string,
                languages: argv.languages as string[] | undefined,
                keyFilter,
                textFilter,
                format: argv.format as string | undefined,
            });

            if (output) {
                console.log(output);
            }
        },
    } satisfies CommandModule;
}

function globToRegExp(glob: string): RegExp {
    const escaped = glob.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
}

function buildMatcher(filter?: FilterSpec): (value: string) => boolean {
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

function renderTemplate(template: string, context: { language: string; key: string; text: string }): string {
    const originalEscape = Mustache.escape;
    Mustache.escape = (text) => text;
    try {
        return Mustache.render(template, context);
    } finally {
        Mustache.escape = originalEscape;
    }
}

export async function list(options: ListOptions): Promise<string> {
    const data = await readXCStrings(options.path);
    const strings = data.strings ?? {};

    const matchKey = buildMatcher(options.keyFilter);
    const matchText = buildMatcher(options.textFilter);
    const languageSet = options.languages ? new Set(options.languages) : null;
    const useTemplate = Boolean(options.format);

    const lines: string[] = [];

    for (const key of Object.keys(strings)) {
        if (!matchKey(key)) continue;

        const unit = strings[key];
        const localizations = unit?.localizations ?? {};
        const localizationKeys = Object.keys(localizations);

        const perKeyLines: string[] = [];

        for (const lang of localizationKeys) {
            if (languageSet && !languageSet.has(lang)) continue;
            const text = localizations[lang]?.stringUnit?.value ?? '';
            if (!matchText(text)) continue;

            if (useTemplate && options.format) {
                perKeyLines.push(renderTemplate(options.format, { language: lang, key, text }));
            } else {
                perKeyLines.push(`  ${lang}: ${JSON.stringify(text)}`);
            }
        }

        if (perKeyLines.length === 0) {
            continue;
        }

        if (useTemplate) {
            lines.push(...perKeyLines);
        } else {
            lines.push(`${key}:`, ...perKeyLines);
        }
    }

    return lines.join('\n');
}
