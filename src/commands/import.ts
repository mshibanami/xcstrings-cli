import { CommandModule } from 'yargs';
import { resolve, dirname, basename, extname } from 'node:path';
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { select, input } from '@inquirer/prompts';
import fg from 'fast-glob';
import { parseStrings } from '../utils/strings-parser.js';
import { mergeTranslationUnit } from '../utils/unit-merger.js';
import chalk from 'chalk';
import {
    readXCStrings,
    writeXCStrings,
    XCStrings,
    XCStringUnit,
    LocalizationState,
    sortXCStringsKeys,
} from './_shared.js';
import { loadConfig } from '../utils/config.js';
import { resolveXCStringsPath } from '../utils/path.js';
import logger from '../utils/logger.js';

export type ImportMergePolicy = 'source-first' | 'destination-first' | 'error';

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

export function createImportCommand(): CommandModule {
    return {
        command: 'import <sources...>',
        describe:
            'Import keys from .xcstrings or .strings files into a target .xcstrings file',
        builder: (yargs) =>
            yargs
                .positional('sources', {
                    describe: 'Source files to import (supports globs)',
                    type: 'string',
                    array: true,
                    demandOption: true,
                })
                .option('target', {
                    alias: 't',
                    type: 'string',
                    describe: 'Target xcstrings file (path or alias)',
                    demandOption: false,
                })
                .option('source-language', {
                    type: 'string',
                    describe: 'Source language for the new xcstrings file',
                })
                .option('language', {
                    alias: 'l',
                    type: 'string',
                    describe: 'Explicit language for .strings files',
                })
                .option('import-merge-policy', {
                    type: 'string',
                    choices: ['source-first', 'destination-first', 'error'],
                    describe: 'How to handle existing keys in the target file',
                }),
        handler: async (argv) => {
            const sources = argv.sources as string[];
            const targetAttr = argv.target as string | undefined;
            const sourceLanguageOpt = argv['source-language'] as
                | string
                | undefined;
            const explicitLanguage = argv.language as string | undefined;

            const config = await loadConfig(argv.config as string | undefined);
            const targetPath = await resolveXCStringsPath(
                targetAttr,
                config,
                resolve(process.cwd(), 'Localizable.xcstrings'),
            );

            const mergePolicy =
                (argv['import-merge-policy'] as ImportMergePolicy) ||
                (config?.importMergePolicy as ImportMergePolicy) ||
                'source-first';

            const resolvedSources = await fg(sources, { absolute: true });
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
                let sourceLanguage = sourceLanguageOpt;
                if (!sourceLanguage) {
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
                    await importXCStrings(sourcePath, targetData, mergePolicy);
                } else if (extension === '.strings') {
                    const language =
                        explicitLanguage || getLanguageFromPath(sourcePath);
                    if (!language) {
                        logger.warn(
                            `Could not determine language for ${sourcePath}. Skipping.`,
                        );
                        continue;
                    }
                    await importStrings(
                        sourcePath,
                        targetData,
                        language,
                        mergePolicy,
                    );
                } else {
                    logger.warn(
                        `Unsupported file type: ${sourcePath}. Skipping.`,
                    );
                }
            }

            if (Object.keys(targetData.strings).length > initialKeyCount) {
                targetData.strings = sortXCStringsKeys(targetData.strings);
            }

            await mkdir(dirname(targetPath), { recursive: true });
            await writeXCStrings(targetPath, targetData);
            logger.info(
                chalk.green(`✓ Successfully imported keys to ${targetPath}`),
            );
        },
    } satisfies CommandModule;
}

async function importXCStrings(
    sourcePath: string,
    targetData: XCStrings,
    mergePolicy: ImportMergePolicy,
) {
    const sourceData = await readXCStrings(sourcePath);
    for (const [key, sourceUnit] of Object.entries(sourceData.strings ?? {})) {
        if (targetData.strings[key]) {
            if (mergePolicy === 'error') {
                throw new Error(`Key already exists in target: ${key}`);
            }
            if (mergePolicy === 'destination-first') {
                continue;
            }
        }

        const targetUnit = targetData.strings[key];
        targetData.strings[key] = mergeTranslationUnit(targetUnit, sourceUnit, {
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
) {
    const content = await readFile(sourcePath);
    const parsed = parseStrings(content);

    for (const [key, entry] of Object.entries(parsed)) {
        let stringValue = entry.text;
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
