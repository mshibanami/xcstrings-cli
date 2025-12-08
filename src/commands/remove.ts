import { readXCStrings, writeXCStrings, XCStringUnit } from './_shared';

function removeLanguagesFromUnit(
    unit: XCStringUnit,
    languages: string[],
    dryRun: boolean,
    key: string,
    result: Record<string, string[]>,
): void {
    if (!unit.localizations) {
        return;
    }
    for (const lang of languages) {
        if (unit.localizations[lang]) {
            result[key] ??= [];
            result[key].push(lang);
            if (!dryRun) {
                delete unit.localizations[lang];
            }
        }
    }
    if (!dryRun && unit.localizations && Object.keys(unit.localizations).length === 0) {
        delete unit.localizations;
    }
}

export async function remove(
    path: string,
    key?: string,
    languages?: string[],
    dryRun = false,
): Promise<Record<string, string[]>> {
    const data = await readXCStrings(path);
    const result: Record<string, string[]> = {};

    const strings = data.strings || {};
    data.strings = strings;

    const targetKeys = key ? [key] : Object.keys(strings);
    let changed = false;

    for (const targetKey of targetKeys) {
        const unit = strings[targetKey];
        if (!unit) {
            continue;
        }
        if (!languages || languages.length === 0) {
            const removedLangs = Object.keys(unit.localizations ?? {});
            result[targetKey] = removedLangs;
            if (!dryRun) {
                delete strings[targetKey];
            }
            changed = true;
            continue;
        }
        removeLanguagesFromUnit(unit, languages, dryRun, targetKey, result);

        const removedCount = result[targetKey]?.length ?? 0;
        const hasLocalizations = unit.localizations && Object.keys(unit.localizations).length > 0;

        if (!hasLocalizations && removedCount > 0) {
            if (!dryRun) {
                delete strings[targetKey];
            }
        }
        if (removedCount > 0) {
            changed = true;
        }
    }
    if (!dryRun && changed) {
        await writeXCStrings(path, data);
    }
    return result;
}
