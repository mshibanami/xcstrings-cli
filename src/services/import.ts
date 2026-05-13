import { resolve, dirname, extname } from 'node:path';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { input } from '@inquirer/prompts';
import fg from 'fast-glob';
import { parseStrings } from '../utils/strings-parser.js';
import { mergeTranslationUnit } from '../utils/unit-merger.js';
import { buildMatcher } from '../utils/filters.js';
import {
    readXCStrings,
    writeXCStrings,
    XCStrings,
    XCStringUnit,
    sortXCStringsKeys,
} from './shared/xcstrings.js';
import { loadConfig } from '../utils/config.js';
import { resolveXCStringsPath } from '../utils/path.js';
import { isInteractiveMode } from '../utils/interactive.js';

export type ImportMergePolicy = 'source-first' | 'destination-first' | 'error';

export interface RunImportCommandOptions {
    sources: string[];
    target?: string;
    language?: string;
    configPath?: string;
    mergePolicy?: ImportMergePolicy;
    keyFilter?: unknown;
    textFilter?: unknown;
    languages?: string[];
    onWarning?: (message: string) => void;
}

async function fileExists(path: string): Promise<boolean> {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

function getLanguageFromPath(path: string): string | null {
    const parts = path.split('/');
    const lprojIndex = parts.findLastIndex((p) => p.endsWith('.lproj'));
    if (lprojIndex !== -1) {
        return parts[lprojIndex].replace('.lproj', '');
    }
    return null;
}

export async function runImportCommand(
    options: RunImportCommandOptions,
): Promise<{ targetPath: string }> {
    const interactive = isInteractiveMode();

    const config = await loadConfig(options.configPath);
    const targetPath = await resolveXCStringsPath(
        options.target,
        config,
        resolve(process.cwd(), 'Localizable.xcstrings'),
        { interactive },
    );

    const mergePolicy =
        options.mergePolicy ||
        (config?.importMergePolicy as ImportMergePolicy) ||
        'source-first';

    const resolvedSources = await fg(options.sources, { absolute: true });
    if (resolvedSources.length === 0) {
        throw new Error(
            'No source files found matching the provided patterns.',
        );
    }

    let targetData: XCStrings;
    const targetExists = await fileExists(targetPath);

    if (targetExists) {
        targetData = await readXCStrings(targetPath);
    } else {
        let sourceLanguage = options.language;

        if (!sourceLanguage && resolvedSources.length > 0) {
            const firstSource = resolvedSources[0];
            if (extname(firstSource).toLowerCase() === '.strings') {
                sourceLanguage = getLanguageFromPath(firstSource) ?? undefined;
            } else if (extname(firstSource).toLowerCase() === '.xcstrings') {
                try {
                    const firstData = await readXCStrings(firstSource);
                    sourceLanguage = firstData.sourceLanguage;
                } catch {
                    // Ignored if fails
                }
            }
        }

        if (!sourceLanguage) {
            if (!interactive) {
                throw new Error(
                    'Non-interactive mode requires --language when creating a new xcstrings file and source language cannot be inferred.',
                );
            }
            sourceLanguage = await input({
                message:
                    'Enter the source language for the new xcstrings file:',
                default: 'en-US',
            });
        }
        targetData = {
            sourceLanguage,
            version: '1.0',
            strings: {},
        };
    }

    const initialKeyCount = Object.keys(targetData.strings).length;

    for (const sourcePath of resolvedSources) {
        const extension = extname(sourcePath).toLowerCase();
        if (extension === '.xcstrings') {
            await importXCStrings(
                sourcePath,
                targetData,
                mergePolicy,
                options.keyFilter,
                options.textFilter,
                options.languages,
            );
        } else if (extension === '.strings') {
            const language =
                getLanguageFromPath(sourcePath) || options.language;
            if (!language) {
                options.onWarning?.(
                    `Could not determine language for ${sourcePath}. Skipping.`,
                );
                continue;
            }
            await importStrings(
                sourcePath,
                targetData,
                language,
                mergePolicy,
                options.keyFilter,
                options.textFilter,
                options.languages,
            );
        } else {
            options.onWarning?.(
                `Unsupported file type: ${sourcePath}. Skipping.`,
            );
        }
    }

    if (Object.keys(targetData.strings).length > initialKeyCount) {
        targetData.strings = sortXCStringsKeys(targetData.strings);
    }

    await mkdir(dirname(targetPath), { recursive: true });
    await writeXCStrings(targetPath, targetData);

    return { targetPath };
}

async function importXCStrings(
    sourcePath: string,
    targetData: XCStrings,
    mergePolicy: ImportMergePolicy,
    keyFilter?: unknown,
    textFilter?: unknown,
    languages?: string[],
) {
    const sourceData = await readXCStrings(sourcePath);
    const matchKey = buildMatcher(keyFilter as any);
    const matchText = buildMatcher(textFilter as any);
    const languageSet = languages ? new Set(languages) : null;

    for (const [key, sourceUnit] of Object.entries(sourceData.strings ?? {})) {
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
            if (mergePolicy === 'error') {
                throw new Error(`Key already exists in target: ${key}`);
            }
            if (mergePolicy === 'destination-first') {
                continue;
            }
        }

        const targetUnit = targetData.strings[key];
        targetData.strings[key] = mergeTranslationUnit(targetUnit, newUnit, {
            mergePolicy,
            keyName: key,
            sortLocalizations: 'auto',
        });
    }
}

async function importStrings(
    sourcePath: string,
    targetData: XCStrings,
    language: string,
    mergePolicy: ImportMergePolicy,
    keyFilter?: unknown,
    textFilter?: unknown,
    languages?: string[],
) {
    const languageSet = languages ? new Set(languages) : null;
    if (languageSet && !languageSet.has(language)) {
        return;
    }

    const matchKey = buildMatcher(keyFilter as any);
    const matchText = buildMatcher(textFilter as any);

    const content = await readFile(sourcePath);
    const parsed = parseStrings(content);

    for (const [key, entry] of Object.entries(parsed)) {
        if (!matchKey(key)) continue;

        const stringValue = entry.text;
        if (!matchText(stringValue)) continue;

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
                        value: stringValue,
                    },
                },
            },
        };

        targetData.strings[key] = mergeTranslationUnit(
            existingUnit,
            sourceUnit,
            {
                mergePolicy,
                keyName: key,
                sortLocalizations: 'auto',
            },
        );
    }
}
