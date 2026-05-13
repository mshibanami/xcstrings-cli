import { StringsEntry } from '../../utils/strings-parser.js';
import { buildMatcher } from '../../utils/filters.js';
import { mergeTranslationUnit } from '../../utils/unit-merger.js';
import { XCStrings, XCStringUnit } from '../shared/xcstrings.js';
import type { ImportMergePolicy } from '../import.js';
import { DomainError } from '../../utils/errors.js';

export interface ImportCoreOptions {
    mergePolicy: ImportMergePolicy;
    keyFilter?: unknown;
    textFilter?: unknown;
    languages?: string[];
}

export function mergeXCStringsEntriesIntoTarget(
    sourceEntries: Record<string, XCStringUnit>,
    targetData: XCStrings,
    options: ImportCoreOptions,
): void {
    const matchKey = buildMatcher(options.keyFilter as any);
    const matchText = buildMatcher(options.textFilter as any);
    const languageSet = options.languages ? new Set(options.languages) : null;

    for (const [key, sourceUnit] of Object.entries(sourceEntries)) {
        if (!matchKey(key)) continue;

        const newUnit = JSON.parse(JSON.stringify(sourceUnit)) as XCStringUnit;

        if (newUnit.localizations) {
            for (const lang of Object.keys(newUnit.localizations)) {
                if (languageSet && !languageSet.has(lang)) {
                    delete newUnit.localizations[lang];
                    continue;
                }
                const val =
                    newUnit.localizations[lang]?.stringUnit?.value ?? '';
                if (!matchText(val)) {
                    delete newUnit.localizations[lang];
                }
            }
        }

        if (
            newUnit.localizations &&
            Object.keys(newUnit.localizations).length === 0
        ) {
            continue;
        }

        if (targetData.strings[key]) {
            if (options.mergePolicy === 'error') {
                throw new DomainError(
                    'MERGE_CONFLICT',
                    `Key already exists in target: ${key}`,
                    { key },
                );
            }
            if (options.mergePolicy === 'destination-first') {
                continue;
            }
        }

        const targetUnit = targetData.strings[key];
        targetData.strings[key] = mergeTranslationUnit(targetUnit, newUnit, {
            mergePolicy: options.mergePolicy,
            keyName: key,
            sortLocalizations: 'auto',
        });
    }
}

export function mergeStringsEntriesIntoTarget(
    parsedEntries: Record<string, StringsEntry>,
    targetData: XCStrings,
    language: string,
    options: ImportCoreOptions,
): void {
    const languageSet = options.languages ? new Set(options.languages) : null;
    if (languageSet && !languageSet.has(language)) {
        return;
    }

    const matchKey = buildMatcher(options.keyFilter as any);
    const matchText = buildMatcher(options.textFilter as any);

    for (const [key, entry] of Object.entries(parsedEntries)) {
        if (!matchKey(key)) continue;
        if (!matchText(entry.text)) continue;

        let comment = entry.comment;
        if (
            comment?.trim() === 'No comment provided by engineer.' ||
            comment?.trim() === ''
        ) {
            comment = undefined;
        }

        const existingUnit = targetData.strings[key];
        const sourceUnit: XCStringUnit = {
            extractionState: 'migrated',
            comment,
            localizations: {
                [language]: {
                    stringUnit: {
                        state: 'translated',
                        value: entry.text,
                    },
                },
            },
        };

        targetData.strings[key] = mergeTranslationUnit(existingUnit, sourceUnit, {
            mergePolicy: options.mergePolicy,
            keyName: key,
            sortLocalizations: 'auto',
        });
    }
}
