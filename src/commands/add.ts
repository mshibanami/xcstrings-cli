import { readXCStrings, writeXCStrings, XCStringUnit } from './_shared';
import { loadConfig, MissingLanguagePolicy } from '../utils/config';
import { languages } from './languages';

export async function add(
    path: string,
    key: string,
    comment: string | undefined,
    strings: Record<string, string> | undefined,
    configPath?: string
): Promise<void> {
    const data = await readXCStrings(path);

    if (!data.strings) {
        data.strings = {};
    }

    const unit: XCStringUnit = {
        ...data.strings[key],
        extractionState: 'manual',
    };

    if (comment) {
        unit.comment = comment;
    }

    if (strings) {
        const config = await loadConfig(configPath);
        const handleMissing: MissingLanguagePolicy = config?.missingLanguagePolicy || 'skip';
        const supportedLanguages = await languages(path, configPath);
        const toAdd: Array<[string, string]> = [];
        for (const [lang, value] of Object.entries(strings)) {
            if (supportedLanguages.includes(lang) || handleMissing === 'include') {
                toAdd.push([lang, value]);
            }
        }
        if (toAdd.length > 0) {
            unit.localizations = unit.localizations || {};
            for (const [lang, value] of toAdd) {
                unit.localizations[lang] = {
                    stringUnit: {
                        state: 'translated',
                        value: value,
                    },
                };
            }
        }
    }

    data.strings[key] = unit;
    await writeXCStrings(path, data);
}
