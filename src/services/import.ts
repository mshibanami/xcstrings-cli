import { resolve, dirname, extname } from 'node:path';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { input } from '@inquirer/prompts';
import fg from 'fast-glob';
import { parseStrings } from '../utils/strings-parser.js';
import {
    readXCStrings,
    writeXCStrings,
    XCStrings,
    sortXCStringsKeys,
} from './shared/xcstrings.js';
import { loadConfig } from '../utils/config.js';
import { resolveXCStringsPath } from '../utils/path.js';
import { isInteractiveMode } from '../utils/interactive.js';
import {
    mergeStringsEntriesIntoTarget,
    mergeXCStringsEntriesIntoTarget,
} from './core/import-core.js';

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
    mergeXCStringsEntriesIntoTarget(sourceData.strings ?? {}, targetData, {
        mergePolicy,
        keyFilter,
        textFilter,
        languages,
    });
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
    const content = await readFile(sourcePath);
    const parsed = parseStrings(content);
    mergeStringsEntriesIntoTarget(parsed, targetData, language, {
        mergePolicy,
        keyFilter,
        textFilter,
        languages,
    });
}
