#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import type { Argv, CommandModule, MiddlewareFunction } from 'yargs';
import { resolve } from 'node:path';
import { loadConfig } from './utils/config';
import { resolveXCStringsPath } from './utils/path';
import chalk from 'chalk';
import { createAddCommand } from './commands/add';
import { createRemoveCommand } from './commands/remove';
import { createInitCommand } from './commands/init';
import { createLanguagesCommand } from './commands/languages';
import { createStringsCommand } from './commands/strings';
import { createExportCommand } from './commands/export';
import { createImportCommand } from './commands/import';
import { ArgumentError } from './utils/errors';
import { isInteractiveMode } from './utils/interactive.js';

const defaultPath = resolve(process.cwd(), 'Localizable.xcstrings');

const resolvePathMiddleware: MiddlewareFunction = async (argv) => {
    const config = await loadConfig(argv.config as string | undefined);
    argv.path = await resolveXCStringsPath(
        argv.path as string | undefined,
        config,
        defaultPath,
        { interactive: isInteractiveMode() },
    );
};

function registerCommandWithMiddlewares(
    cli: Argv,
    commandModule: CommandModule,
    middlewares: MiddlewareFunction[],
): void {
    if (!commandModule.command) {
        throw new Error('Command module must define command.');
    }

    const builder =
        (commandModule.builder as any) ??
        ((yargsInstance: Argv) => yargsInstance);
    const handler = commandModule.handler as any;
    const deprecated = commandModule.deprecated;

    if (commandModule.describe === false) {
        cli.command(
            commandModule.command,
            false,
            builder,
            handler,
            middlewares,
            deprecated,
        );
        return;
    }

    cli.command(
        commandModule.command,
        commandModule.describe ?? '',
        builder,
        handler,
        middlewares,
        deprecated,
    );
}

const pathAwareCommands: CommandModule[] = [
    createAddCommand(),
    createRemoveCommand(),
    createLanguagesCommand(),
    createStringsCommand(),
    createExportCommand(),
];

const pathIndependentCommands: CommandModule[] = [
    createInitCommand(),
    createImportCommand(),
];

const cli = yargs(hideBin(process.argv))
    .scriptName('xcs')
    .usage('$0 <cmd> [args]')
    .option('config', {
        type: 'string',
        describe: 'Path to config file',
    })
    .option('path', {
        type: 'string',
        describe: 'Path or alias to xcstrings file',
        default: defaultPath,
    });

for (const commandModule of pathAwareCommands) {
    registerCommandWithMiddlewares(cli, commandModule, [resolvePathMiddleware]);
}

for (const commandModule of pathIndependentCommands) {
    cli.command(commandModule);
}

cli
    .demandCommand(1, 'Please specify a command')
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
    .help().argv;
