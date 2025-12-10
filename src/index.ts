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
