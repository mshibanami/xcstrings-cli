import chalk from 'chalk';
import { CommandModule } from 'yargs';
import { LOCALIZATION_STATES } from './_shared';
import logger from '../utils/logger.js';
import { runAddCommand } from '../services/add.js';
import type { StringsFormat } from '../services/add.js';

export function createAddCommand(): CommandModule {
    return {
        command: 'add',
        describe: 'Add a string',
        builder: (yargs) =>
            yargs
                .option('key', {
                    type: 'string',
                    describe:
                        'The key of the string (omit when adding multiple keys via --strings)',
                    demandOption: false,
                })
                .option('comment', {
                    type: 'string',
                    describe: 'The comment for the string',
                })
                .option('language', {
                    type: 'string',
                    alias: 'l',
                    describe: 'The language of the string provided with --text',
                })
                .option('state', {
                    type: 'string',
                    choices: LOCALIZATION_STATES,
                    describe:
                        'State to apply to added strings (translated | needs_review | new | stale)',
                })
                .option('text', {
                    type: 'string',
                    describe: 'The string value for the default language',
                })
                .option('strings', {
                    type: 'string',
                    describe: 'The strings JSON or YAML',
                })
                .option('strings-format', {
                    type: 'string',
                    choices: ['auto', 'json', 'yaml'] as const,
                    default: 'auto',
                    describe: 'Format for the data provided with --strings',
                })
                .option('interactive', {
                    type: 'boolean',
                    alias: 'i',
                    describe: 'Add strings in an interactive flow',
                }),
        handler: async (argv) => {
            const result = await runAddCommand({
                path: argv.path as string,
                key: argv.key as string,
                comment: argv.comment as string | undefined,
                stringsArg: argv.strings,
                stringsFormat: argv['strings-format'] as StringsFormat,
                defaultString: argv.text as string | undefined,
                language: argv.language as string | undefined,
                state: argv.state as string | undefined,
                stdinReader: undefined,
                configPath: argv.config as string | undefined,
                interactive: argv.interactive as boolean | undefined,
                onWarning: (message) => logger.warn(message),
            });
            logger.info(
                chalk.green(
                    `✓ Added keys:\n${result.keys.map((k) => `- ${k}`).join('\n')}`,
                ),
            );
        },
    } satisfies CommandModule;
}

export {
    add,
    parseStringsArg,
    readStdinToString,
    runAddCommand,
    runInteractiveAdd,
} from '../services/add.js';

export type {
    AddResult,
    InteractiveAddOptions,
    ParsedStringsArg,
    StringsFormat,
} from '../services/add.js';
