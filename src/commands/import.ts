import { CommandModule } from 'yargs';
import {
    addFilterOptions,
    checkFilterOptions,
    extractFilterOptions,
} from '../utils/filters.js';
import chalk from 'chalk';
import logger from '../utils/logger.js';
import { runImportCommand } from '../services/import.js';
import type { ImportMergePolicy } from '../services/import.js';
import { loadConfig } from '../utils/config.js';

export function createImportCommand(): CommandModule {
    return {
        command: 'import <sources...>',
        describe:
            'Import keys from .xcstrings or .strings files into a target .xcstrings file',
        builder: (yargs) =>
            addFilterOptions(yargs)
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
                .option('language', {
                    type: 'string',
                    describe:
                        'Language to use for parsing source files, and as the default sourceLanguage if creating a new xcstrings catalog.',
                })
                .option('languages', {
                    type: 'string',
                    array: true,
                    alias: 'l',
                    describe: 'Include only these languages',
                })
                .option('merge-policy', {
                    type: 'string',
                    choices: ['source-first', 'destination-first', 'error'],
                    describe: 'How to handle existing keys in the target file',
                })
                .check((argv: any) => {
                    return checkFilterOptions(argv);
                }),
        handler: async (argv) => {
            const { keyFilter, textFilter } = extractFilterOptions(argv);
            const config = await loadConfig(argv.config as string | undefined);

            const result = await runImportCommand({
                sources: argv.sources as string[],
                target: argv.target as string | undefined,
                language: argv.language as string | undefined,
                config,
                mergePolicy: argv['merge-policy'] as
                    | ImportMergePolicy
                    | undefined,
                keyFilter,
                textFilter,
                languages: argv.languages as string[] | undefined,
                onWarning: (message) => logger.warn(message),
            });

            logger.info(
                chalk.green(
                    `✓ Successfully imported keys to ${result.targetPath}`,
                ),
            );
        },
    } satisfies CommandModule;
}

export type { ImportMergePolicy };
