import { readXCStrings, writeXCStrings, XCStringUnit } from './_shared';
import { loadConfig, MissingLanguagePolicy } from '../utils/config';
import { languages } from './languages';

export async function add(
    path: string,
    key: string,
    comment: string | undefined,
    strings: Record<string, string> | undefined,
    configPath?: string,
    defaultString?: string,
    language?: string
): Promise<void> {
    const data = await readXCStrings(path);

    if (!data.sourceLanguage) {
        throw new Error('The xcstrings file is missing "sourceLanguage".');
    }

    const sourceLanguage = data.sourceLanguage;

    if (!data.strings) {
        data.strings = {};
    }

    const config = await loadConfig(configPath);
    const handleMissing: MissingLanguagePolicy = config?.missingLanguagePolicy || 'skip';
    let supportedLanguages: string[] | undefined;

    const ensureSupported = async (lang: string): Promise<boolean> => {
        if (handleMissing === 'include') {
            return true;
        }
        if (!supportedLanguages) {
            supportedLanguages = await languages(path, configPath);
        }
        return supportedLanguages.includes(lang);
    };

    const unit: XCStringUnit = {
        ...data.strings[key],
        extractionState: 'manual',
    };

    if (comment) {
        unit.comment = comment;
    }

    if (defaultString !== undefined) {
        const targetLanguage = language ?? sourceLanguage;
        if (!(await ensureSupported(targetLanguage))) {
            throw new Error(`Language "${targetLanguage}" is not supported.`);
        }
        unit.localizations = unit.localizations || {};
        unit.localizations[targetLanguage] = {
            stringUnit: {
                state: 'translated',
                value: defaultString,
            },
        };
    }

    const mergedStrings = strings ? { ...strings } : undefined;

    if (mergedStrings) {
        const toAdd: Array<[string, string]> = [];
        for (const [lang, value] of Object.entries(mergedStrings)) {
            const targetLanguage = language ?? sourceLanguage;
            if (defaultString !== undefined && lang === targetLanguage) {
                continue;
            }
            const supported = handleMissing === 'include'
                ? true
                : (lang === sourceLanguage || await ensureSupported(lang));
            if (supported) {
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
