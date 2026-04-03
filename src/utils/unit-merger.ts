import { XCStringUnit } from '../commands/_shared.js';
import { ImportMergePolicy } from '../commands/import.js';

type LocalizationMap = NonNullable<XCStringUnit['localizations']>;

export interface MergeTranslationOptions {
    mergePolicy?: ImportMergePolicy;
    extractionState?: XCStringUnit['extractionState'];
    sortLocalizations?: boolean;
    keyName?: string;
}

export function sortLocalizations(
    localizations: LocalizationMap,
): LocalizationMap {
    const sorted = Object.entries(localizations).sort(([langA], [langB]) =>
        langA.localeCompare(langB, 'en', { sensitivity: 'case' }),
    );
    return Object.fromEntries(sorted) as LocalizationMap;
}

export function mergeTranslationUnit(
    targetUnit: XCStringUnit | undefined,
    sourceUnit: XCStringUnit,
    options?: MergeTranslationOptions,
): XCStringUnit {
    const policy = options?.mergePolicy || 'source-first';
    const mergedUnit: XCStringUnit = targetUnit ? { ...targetUnit } : {};

    for (const [key, value] of Object.entries(sourceUnit)) {
        if (key === 'localizations') continue;

        if (policy === 'destination-first') {
            if (
                mergedUnit[key as keyof XCStringUnit] === undefined &&
                value !== undefined
            ) {
                (mergedUnit as any)[key] = value;
            }
        } else {
            if (value !== undefined) {
                (mergedUnit as any)[key] = value;
            }
        }
    }

    if (targetUnit?.localizations) {
        mergedUnit.localizations = { ...targetUnit.localizations };
    } else if (sourceUnit.localizations) {
        mergedUnit.localizations = {};
    }

    if (sourceUnit.localizations) {
        for (const [lang, sourceLoc] of Object.entries(
            sourceUnit.localizations,
        )) {
            const hasExistingLoc = targetUnit?.localizations?.[lang];

            if (hasExistingLoc) {
                if (policy === 'error') {
                    throw new Error(
                        `Key${
                            options?.keyName ? ` "${options.keyName}"` : ''
                        } already has localization for "${lang}" in target.`,
                    );
                }
                if (policy === 'destination-first') {
                    continue;
                }
            }
            mergedUnit.localizations![lang] = sourceLoc;
        }
    }

    if (options?.extractionState) {
        mergedUnit.extractionState = options.extractionState;
    }

    if (options?.sortLocalizations && mergedUnit.localizations) {
        mergedUnit.localizations = sortLocalizations(mergedUnit.localizations);
    }

    return mergedUnit;
}
