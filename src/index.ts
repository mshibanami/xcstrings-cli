#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { resolve } from 'node:path';
import { loadConfig } from './utils/config';
import { resolveXCStringsPath } from './utils/path';
import chalk from 'chalk';
import { createAddCommand } from './commands/add';
import { createRemoveCommand } from './commands/remove';
import { createInitCommand } from './commands/init';
import { createLanguagesCommand } from './commands/languages';
import { createStringsCommand } from './commands/strings';
import { ArgumentError } from './utils/errors';

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
    .command([
        createAddCommand(),
        createRemoveCommand(),
        createInitCommand(),
        createLanguagesCommand(),
        createStringsCommand(),
    ])
    .demandCommand(1, '')
    .strictCommands()
    .recommendCommands()
    .fail((msg, err, yargsInstance) => {
        const isArgumentError = err instanceof ArgumentError;

        if (msg || isArgumentError) {
            console.error(chalk.red(msg || err?.message || err));
            console.log();
            yargsInstance.showHelp();
            process.exit(1);
        }

        if (err) {
            console.error(chalk.red(err.message || err));
            process.exit(1);
        }

        process.exit(1);
    })
    .help()
    .argv;
