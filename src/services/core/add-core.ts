import {
    LocalizationPayload,
    LocalizationState,
    XCStrings,
    XCStringUnit,
    sortXCStringsKeys,
} from '../shared/xcstrings.js';
import { mergeTranslationUnit } from '../../utils/unit-merger.js';

export interface AddToCatalogInput {
    key: string;
    comment?: string;
    defaultString?: string;
    defaultLanguage?: string;
    translations?: Record<string, LocalizationPayload | string>;
    state: LocalizationState;
}

function toPayload(
    input?: LocalizationPayload | string,
): LocalizationPayload | undefined {
    if (input === undefined) return undefined;
    if (typeof input === 'string') {
        return { value: input };
    }
    return input;
}

export function buildSourceUnit(input: AddToCatalogInput): XCStringUnit {
    const sourceUnit: XCStringUnit = {
        extractionState: 'manual',
    };

    if (input.comment) {
        sourceUnit.comment = input.comment;
    }

    if (input.defaultString !== undefined && input.defaultLanguage) {
        sourceUnit.localizations = sourceUnit.localizations || {};
        const payload = toPayload(input.translations?.[input.defaultLanguage]);
        sourceUnit.localizations[input.defaultLanguage] = {
            stringUnit: {
                state: payload?.state ?? input.state,
                value: input.defaultString,
            },
        };
    }

    if (input.translations) {
        for (const [lang, raw] of Object.entries(input.translations)) {
            if (
                input.defaultString !== undefined &&
                input.defaultLanguage &&
                lang === input.defaultLanguage
            ) {
                continue;
            }
            const payload = toPayload(raw);
            if (!payload) continue;
            sourceUnit.localizations = sourceUnit.localizations || {};
            sourceUnit.localizations[lang] = {
                stringUnit: {
                    state: payload.state ?? input.state,
                    value: payload.value,
                },
            };
        }
    }

    return sourceUnit;
}

export function addToCatalog(data: XCStrings, input: AddToCatalogInput): void {
    if (!data.strings) {
        data.strings = {};
    }

    const isNewKey = !(input.key in data.strings);
    const sourceUnit = buildSourceUnit(input);

    data.strings[input.key] = mergeTranslationUnit(
        data.strings[input.key],
        sourceUnit,
        {
            mergePolicy: 'source-first',
            sortLocalizations: 'auto',
        },
    );

    if (isNewKey) {
        data.strings = sortXCStringsKeys(data.strings);
    }
}
