#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { remove, init, languages } from './commands/index.js';
import { resolve } from 'node:path';
import { loadConfig } from './utils/config.js';
import logger from './utils/logger.js';
import { runAddCommand } from './utils/cli.js';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';

const defaultPath = resolve(process.cwd(), 'Localizable.xcstrings');

yargs(hideBin(process.argv))
    .scriptName('xcstrings')
    .usage('$0 <cmd> [args]')
    .option('config', {
        type: 'string',
        describe: 'Path to config file',
    })
    .option('path', {
        type: 'string',
        describe: 'Path to xcstrings file',
        default: defaultPath
    })
    .middleware(async (argv) => {
        if (argv.path !== defaultPath) {
            return;
        }

        const config = await loadConfig(argv.config as string | undefined);

        if (!config || !config.xcstringsPaths || config.xcstringsPaths.length === 0) {
            return;
        }

        if (config.xcstringsPaths.length === 1) {
            const entry = config.xcstringsPaths[0];
            argv.path = typeof entry === 'string' ? entry : entry.path;
        } else {
            const choices = config.xcstringsPaths.map((entry) => {
                if (typeof entry === 'string') {
                    return { name: entry, value: entry };
                } else {
                    return { name: `${entry.alias} (${entry.path})`, value: entry.path };
                }
            });

            const selectedPath = await select({
                message: 'Select xcstrings file:',
                choices: choices,
            });
            argv.path = selectedPath;
        }
    })
    .command(
        'add',
        'Add a string',
        (yargs) => yargs
            .option('key', {
                type: 'string',
                describe: 'The key of the string',
                demandOption: true,
            })
            .option('comment', {
                type: 'string',
                describe: 'The comment for the string',
            })
            .option('strings', {
                type: 'string',
                describe: 'The strings JSON'
            }),
        async (argv) => {
            await runAddCommand({
                path: argv.path,
                key: argv.key,
                comment: argv.comment,
                stringsArg: argv.strings,
                stdinReader: undefined,
                configPath: argv.config
            });
            logger.info(chalk.green(`✓ Added key "${argv.key}"`));
        },
    )
    .command(
        'remove',
        'Remove a string',
        (yargs) => yargs
            .option('key', {
                type: 'string',
                describe: 'The key to remove',
            })
            .option('languages', {
                type: 'string',
                array: true,
                describe: 'Languages to remove',
            })
            .option('dry-run', {
                type: 'boolean',
                default: false,
                describe: 'Show what would be removed without writing changes',
            })
            .check((argv) => {
                if (argv.key || (argv.languages && (argv.languages as string[]).length > 0)) {
                    return true;
                }
                throw new Error('Either --key or --languages must be provided');
            }),
        async (argv) => {
            const result = await remove(
                argv.path as string,
                argv.key as string | undefined,
                argv.languages as string[] | undefined,
                argv.dryRun === true,
            );

            const removedLanguages = Object.entries(result.localizationsRemoved)
                .map(([k, langs]) => `${k}: ${langs.join(', ')}`)
                .join('; ');
            const removedKeys = result.keysRemoved.join(', ');
            const parts: string[] = [];
            if (removedKeys) parts.push(`keys [${removedKeys}]`);
            if (removedLanguages) parts.push(`localizations [${removedLanguages}]`);

            if (argv.dryRun) {
                if (parts.length === 0) {
                    logger.info(chalk.yellow('Dry run: no matching strings found.'));
                } else {
                    logger.info(chalk.blue(`Dry run: would remove ${parts.join(' and ')}`));
                }
                return;
            }

            if (parts.length === 0) {
                logger.info(chalk.yellow('No matching strings found.'));
            } else {
                logger.info(chalk.green(`✓ Removed ${parts.join(' and ')}`));
            }
        },
    )
    .command(
        'init',
        'Initialize configuration file',
        (yargs) => yargs,
        async () => {
            await init();
        },
    )
    .command(
        'languages',
        'List supported languages from xcodeproj or xcstrings',
        (yargs) => yargs,
        async (argv) => {
            const result = await languages(argv.path as string, argv.config as string | undefined);
            logger.info(result.join(' '));
        },
    )
    .demandCommand(1, '')
    .strictCommands()
    .recommendCommands()
    .showHelpOnFail(true)
    .fail((msg, err, yargsInstance) => {
        if (err) {
            console.error(err);
            throw err;
        }
        if (msg) {
            console.error(chalk.red(msg));
            console.log();
        }
        yargsInstance.showHelp();
        process.exit(1);
    })
    .help()
    .argv;
