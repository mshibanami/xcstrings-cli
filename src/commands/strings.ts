import Mustache from 'mustache';
import { readXCStrings } from './_shared';
import { CommandModule } from 'yargs';
import {
    addFilterOptions,
    checkFilterOptions,
    extractFilterOptions,
    FilterSpec,
    buildMatcher,
} from '../utils/filters.js';

export interface ListOptions {
    path: string;
    languages?: string[];
    missingLanguages?: string[];
    keyFilter?: FilterSpec;
    textFilter?: FilterSpec;
    format?: string;
}

export function createStringsCommand(): CommandModule {
    return {
        command: 'strings',
        describe: 'List strings in the xcstrings file',
        builder: (yargs) =>
            addFilterOptions(yargs)
                .option('languages', {
                    type: 'string',
                    array: true,
                    alias: 'l',
                    describe: 'Include only these languages',
                })
                .option('missing-languages', {
                    type: 'string',
                    array: true,
                    describe:
                        'Include only keys missing any of these languages',
                })
                .option('format', {
                    type: 'string',
                    describe:
                        'Mustache template. Available variables: {{language}}, {{key}}, {{text}}',
                })
                .check((argv: any) => {
                    return checkFilterOptions(argv);
                }),
        handler: async (argv) => {
            const { keyFilter, textFilter } = extractFilterOptions(argv);

            const output = await strings({
                path: argv.path as string,
                languages: argv.languages as string[] | undefined,
                missingLanguages: argv['missing-languages'] as
                    | string[]
                    | undefined,
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

function renderTemplate(
    template: string,
    context: { language: string; key: string; text: string },
): string {
    const originalEscape = Mustache.escape;
    Mustache.escape = (text) => text;
    try {
        return Mustache.render(template, context);
    } finally {
        Mustache.escape = originalEscape;
    }
}

export async function strings(options: ListOptions): Promise<string> {
    const data = await readXCStrings(options.path);
    const strings = data.strings ?? {};

    const matchKey = buildMatcher(options.keyFilter);
    const matchText = buildMatcher(options.textFilter);
    const languageSet = options.languages ? new Set(options.languages) : null;
    const missingLanguageSet = options.missingLanguages
        ? new Set(options.missingLanguages)
        : null;
    const useTemplate = Boolean(options.format);

    const lines: string[] = [];

    for (const key of Object.keys(strings)) {
        if (!matchKey(key)) continue;

        const unit = strings[key];
        const localizations = unit?.localizations ?? {};
        const localizationKeys = Object.keys(localizations);

        const isMissingSpecifiedLanguage = missingLanguageSet
            ? Array.from(missingLanguageSet).some(
                  (lang) => !(lang in localizations),
              )
            : true;

        const perKeyLines: string[] = [];

        for (const lang of localizationKeys) {
            if (languageSet && !languageSet.has(lang)) continue;
            const text = localizations[lang]?.stringUnit?.value ?? '';
            if (!matchText(text)) continue;

            if (useTemplate && options.format) {
                perKeyLines.push(
                    renderTemplate(options.format, {
                        language: lang,
                        key,
                        text,
                    }),
                );
            } else {
                perKeyLines.push(`  ${lang}: ${JSON.stringify(text)}`);
            }
        }

        if (perKeyLines.length === 0) {
            continue;
        }

        if (!isMissingSpecifiedLanguage) {
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
