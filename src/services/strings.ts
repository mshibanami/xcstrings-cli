import Mustache from 'mustache';
import { readXCStrings } from '../commands/_shared.js';
import { FilterSpec, buildMatcher } from '../utils/filters.js';

export interface ListOptions {
    path: string;
    languages?: string[];
    missingLanguages?: string[];
    keyFilter?: FilterSpec;
    textFilter?: FilterSpec;
    format?: string;
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
