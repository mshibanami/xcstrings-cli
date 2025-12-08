import { readXCStrings, writeXCStrings, XCStringUnit } from './_shared';

export async function add(
    path: string,
    key: string,
    comment: string | undefined,
    strings: Record<string, string> | undefined,
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
        unit.localizations = unit.localizations || {};
        for (const [lang, value] of Object.entries(strings)) {
            unit.localizations[lang] = {
                stringUnit: {
                    state: 'translated',
                    value: value,
                },
            };
        }
    }

    data.strings[key] = unit;
    await writeXCStrings(path, data);
}
