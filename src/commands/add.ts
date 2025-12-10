import { readXCStrings, writeXCStrings, XCStringUnit } from './_shared';
import { loadConfig, MissingLanguagePolicy } from '../utils/config';
import { languages } from './languages';
import { CommandModule } from 'yargs';
import { runAddCommand, StringsFormat } from '../utils/cli.js';
import logger from '../utils/logger.js';
import chalk from 'chalk';

export function createAddCommand(): CommandModule {
    return {
        command: 'add',
        describe: 'Add a string',
        builder: (yargs) => yargs
            .option('key', {
                type: 'string',
                describe: 'The key of the string (omit when adding multiple keys via --strings)',
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
        handler: async (argv) => {
            const result = await runAddCommand({
                path: argv.path as string,
                key: argv.key as string,
                comment: argv.comment as string | undefined,
                stringsArg: argv.strings,
                stringsFormat: argv['strings-format'] as StringsFormat,
                defaultString: argv.text as string | undefined,
                language: argv.language as string | undefined,
                stdinReader: undefined,
                configPath: argv.config as string | undefined
            });
            logger.info(chalk.green(`✓ Added keys:\n${result.keys.map((k) => `- ${k}`).join('\n')}`));
        },
    } satisfies CommandModule;
}

export async function add(
    path: string,
    key: string,
    comment: string | undefined,
    strings: Record<string, string> | undefined,
    configPath?: string,
    defaultString?: string,
    language?: string
): Promise<void> {
    const data = await readXCStrings(path);

    if (!data.sourceLanguage) {
        throw new Error('The xcstrings file is missing "sourceLanguage".');
    }

    const sourceLanguage = data.sourceLanguage;

    if (!data.strings) {
        data.strings = {};
    }

    const config = await loadConfig(configPath);
    const handleMissing: MissingLanguagePolicy = config?.missingLanguagePolicy || 'skip';
    let supportedLanguages: string[] | undefined;

    const ensureSupported = async (lang: string): Promise<boolean> => {
        if (handleMissing === 'include') {
            return true;
        }
        if (!supportedLanguages) {
            supportedLanguages = await languages(path, configPath);
        }
        return supportedLanguages.includes(lang);
    };

    const warnUnsupported = (lang: string): void => {
        logger.warn(`Language "${lang}" is not supported. Skipped adding its translation (missingLanguagePolicy=skip).`);
    };

    const unit: XCStringUnit = {
        ...data.strings[key],
        extractionState: 'manual',
    };

    if (comment) {
        unit.comment = comment;
    }

    if (defaultString !== undefined) {
        const targetLanguage = language ?? sourceLanguage;
        if (!(await ensureSupported(targetLanguage))) {
            warnUnsupported(targetLanguage);
        } else {
            unit.localizations = unit.localizations || {};
            unit.localizations[targetLanguage] = {
                stringUnit: {
                    state: 'translated',
                    value: defaultString,
                },
            };
        }
    }

    const mergedStrings = strings ? { ...strings } : undefined;

    if (mergedStrings) {
        const toAdd: Array<[string, string]> = [];
        for (const [lang, value] of Object.entries(mergedStrings)) {
            const targetLanguage = language ?? sourceLanguage;
            if (defaultString !== undefined && lang === targetLanguage) {
                continue;
            }
            const supported = handleMissing === 'include'
                ? true
                : (lang === sourceLanguage || await ensureSupported(lang));
            if (supported) {
                toAdd.push([lang, value]);
            } else {
                warnUnsupported(lang);
            }
        }
        if (toAdd.length > 0) {
            unit.localizations = unit.localizations || {};
            for (const [lang, value] of toAdd) {
                unit.localizations[lang] = {
                    stringUnit: {
                        state: 'translated',
                        value: value,
                    },
                };
            }
        }
    }

    data.strings[key] = unit;
    await writeXCStrings(path, data);
}
