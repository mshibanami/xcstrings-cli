import { readXCStrings, writeXCStrings, XCStringUnit } from './_shared';
import { CommandModule } from 'yargs';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export function createRemoveCommand(): CommandModule {
    return {
        command: 'remove',
        describe: 'Remove a string',
        builder: (yargs) => yargs
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

function removeLanguagesFromUnit(
    unit: XCStringUnit,
    languages: string[],
    dryRun: boolean,
    key: string,
    result: Record<string, string[]>,
): void {
    if (!unit.localizations) {
        return;
    }
    for (const lang of languages) {
        if (unit.localizations[lang]) {
            result[key] ??= [];
            result[key].push(lang);
            if (!dryRun) {
                delete unit.localizations[lang];
            }
        }
    }
    if (!dryRun && unit.localizations && Object.keys(unit.localizations).length === 0) {
        delete unit.localizations;
    }
}

export async function remove(
    path: string,
    key?: string,
    languages?: string[],
    dryRun = false,
): Promise<Record<string, string[]>> {
    const data = await readXCStrings(path);
    const result: Record<string, string[]> = {};

    const strings = data.strings || {};
    data.strings = strings;

    const targetKeys = key ? [key] : Object.keys(strings);
    let changed = false;

    for (const targetKey of targetKeys) {
        const unit = strings[targetKey];
        if (!unit) {
            continue;
        }
        if (!languages || languages.length === 0) {
            const removedLangs = Object.keys(unit.localizations ?? {});
            result[targetKey] = removedLangs;
            if (!dryRun) {
                delete strings[targetKey];
            }
            changed = true;
            continue;
        }
        removeLanguagesFromUnit(unit, languages, dryRun, targetKey, result);

        const removedCount = result[targetKey]?.length ?? 0;
        const hasLocalizations = unit.localizations && Object.keys(unit.localizations).length > 0;

        if (!hasLocalizations && removedCount > 0) {
            if (!dryRun) {
                delete strings[targetKey];
            }
        }
        if (removedCount > 0) {
            changed = true;
        }
    }
    if (!dryRun && changed) {
        await writeXCStrings(path, data);
    }
    return result;
}
