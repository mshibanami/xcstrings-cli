#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { remove, init, languages, list } from './commands/index.js';
import { resolve } from 'node:path';
import { loadConfig } from './utils/config.js';
import logger from './utils/logger.js';
import { runAddCommand, StringsFormat } from './utils/cli.js';
import { resolveXCStringsPath } from './utils/path.js';
import chalk from 'chalk';
import { resolveFilter } from './utils/filters.js';

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
        const config = await loadConfig(argv.config as string | undefined);
        argv.path = await resolveXCStringsPath(argv.path as string, config, defaultPath);
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
            .option('language', {
                type: 'string',
                alias: 'l',
                describe: 'The language of the string provided with --text',
            })
            .option('text', {
                type: 'string',
                describe: 'The string value for the default language',
            })
            .option('strings', {
                type: 'string',
                describe: 'The strings JSON or YAML'
            })
            .option('strings-format', {
                type: 'string',
                choices: ['auto', 'json', 'yaml'] as const,
                default: 'auto',
                describe: 'Format for the data provided with --strings'
            }),
        async (argv) => {
            await runAddCommand({
                path: argv.path,
                key: argv.key,
                comment: argv.comment,
                stringsArg: argv.strings,
                stringsFormat: argv['strings-format'] as StringsFormat,
                defaultString: argv.text,
                language: argv.language,
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
                alias: 'k',
            })
            .option('languages', {
                type: 'string',
                array: true,
                describe: 'Languages to remove',
                alias: 'l',
            })
            .option('dry-run', {
                type: 'boolean',
                default: false,
                describe: 'Show what would be removed without writing changes',
                alias: 'n',
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

            const removedItems = Object.entries(result)
                .map(([k, langs]) => `- [${langs.join(' ')}] ${k}`)
                .join('\n');

            if (argv.dryRun) {
                if (removedItems.length === 0) {
                    logger.info(chalk.yellow('No matching strings found.'));
                } else {
                    logger.info(chalk.blue(`Would remove:\n${removedItems}`));
                }
                return;
            }
            if (removedItems.length === 0) {
                logger.info(chalk.yellow('No matching strings found.'));
            } else {
                logger.info(chalk.green(`✓ Removed\n${removedItems}`));
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
    .command(
        'list',
        'List strings in the xcstrings file',
        (yargs) => yargs
            .option('key', {
                type: 'string',
                describe: 'Filter keys by glob (default)',
            })
            .option('key-glob', {
                type: 'string',
                describe: 'Filter keys by glob (explicit)',
            })
            .option('key-regex', {
                type: 'string',
                describe: 'Filter keys by regex',
            })
            .option('key-substring', {
                type: 'string',
                describe: 'Filter keys by substring match',
            })
            .option('text', {
                type: 'string',
                describe: 'Filter translations by glob (default)',
            })
            .option('text-glob', {
                type: 'string',
                describe: 'Filter translations by glob (explicit)',
            })
            .option('text-regex', {
                type: 'string',
                describe: 'Filter translations by regex',
            })
            .option('text-substring', {
                type: 'string',
                describe: 'Filter translations by substring match',
            })
            .option('languages', {
                type: 'string',
                array: true,
                alias: 'l',
                describe: 'Include only these languages',
            })
            .option('format', {
                type: 'string',
                describe: 'Mustache template. Available variables: {{language}}, {{key}}, {{text}}',
            })
            .check((argv) => {
                const keyGlobCount = [argv.key, argv['key-glob']].filter((v) => v !== undefined).length;
                const keyRegexCount = argv['key-regex'] ? 1 : 0;
                const keySubstringCount = argv['key-substring'] ? 1 : 0;
                if (keyGlobCount + keyRegexCount + keySubstringCount > 1) {
                    throw new Error('Specify only one of --key/--key-glob, --key-regex, or --key-substring');
                }

                const textGlobCount = [argv.text, argv['text-glob']].filter((v) => v !== undefined).length;
                const textRegexCount = argv['text-regex'] ? 1 : 0;
                const textSubstringCount = argv['text-substring'] ? 1 : 0;
                if (textGlobCount + textRegexCount + textSubstringCount > 1) {
                    throw new Error('Specify only one of --text/--text-glob, --text-regex, or --text-substring');
                }

                return true;
            }),
        async (argv) => {
            const keyGlobValues = [argv.key, argv['key-glob']].filter((v) => v !== undefined) as string[];
            const textGlobValues = [argv.text, argv['text-glob']].filter((v) => v !== undefined) as string[];

            const keyFilter = resolveFilter('key', {
                glob: keyGlobValues[0],
                regex: argv['key-regex'] as string | undefined,
                substring: argv['key-substring'] as string | undefined,
            });

            const textFilter = resolveFilter('text', {
                glob: textGlobValues[0],
                regex: argv['text-regex'] as string | undefined,
                substring: argv['text-substring'] as string | undefined,
            });

            const output = await list({
                path: argv.path as string,
                languages: argv.languages as string[] | undefined,
                keyFilter,
                textFilter,
                format: argv.format as string | undefined,
            });

            if (output) {
                console.log(output);
            }
        },
    )
    .demandCommand(1, '')
    .strictCommands()
    .recommendCommands()
    .showHelpOnFail(true)
    .fail((msg, err, yargsInstance) => {
        const message = msg || err?.message;
        if (message) {
            console.error(chalk.red(message));
            console.log();
            yargsInstance.showHelp();
            process.exit(1);
        }

        if (err) {
            console.error(err);
            process.exit(1);
        }

        yargsInstance.showHelp();
        process.exit(1);
    })
    .help()
    .argv;
