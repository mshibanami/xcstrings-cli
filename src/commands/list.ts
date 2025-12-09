import Mustache from 'mustache';
import { readXCStrings } from './_shared';

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
