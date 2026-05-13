import { CommandModule } from 'yargs';
import logger from '../utils/logger.js';
import chalk from 'chalk';
import { remove } from '../services/remove.js';

export function createRemoveCommand(): CommandModule {
    return {
        command: 'remove',
        describe: 'Remove a string',
        builder: (yargs) =>
            yargs
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
                    describe:
                        'Show what would be removed without writing changes',
                    alias: 'n',
                })
                .check((argv) => {
                    if (
                        argv.key ||
                        (argv.languages &&
                            (argv.languages as string[]).length > 0)
                    ) {
                        return true;
                    }
                    throw new Error(
                        'Either --key or --languages must be provided',
                    );
                }),
        handler: async (argv) => {
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
    } satisfies CommandModule;
}

export { remove };
