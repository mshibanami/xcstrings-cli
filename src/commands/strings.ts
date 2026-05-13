import { CommandModule } from 'yargs';
import {
    addFilterOptions,
    checkFilterOptions,
    extractFilterOptions,
} from '../utils/filters.js';
import { strings } from '../services/strings.js';

export function createStringsCommand(): CommandModule {
    return {
        command: 'strings',
        describe: 'List strings in the xcstrings file',
        builder: (yargs) =>
            addFilterOptions(yargs)
                .option('languages', {
                    type: 'string',
                    array: true,
                    alias: 'l',
                    describe: 'Include only these languages',
                })
                .option('missing-languages', {
                    type: 'string',
                    array: true,
                    describe:
                        'Include only keys missing any of these languages',
                })
                .option('format', {
                    type: 'string',
                    describe:
                        'Mustache template. Available variables: {{language}}, {{key}}, {{text}}',
                })
                .check((argv: any) => {
                    return checkFilterOptions(argv);
                }),
        handler: async (argv) => {
            const { keyFilter, textFilter } = extractFilterOptions(argv);

            const output = await strings({
                path: argv.path as string,
                languages: argv.languages as string[] | undefined,
                missingLanguages: argv['missing-languages'] as
                    | string[]
                    | undefined,
                keyFilter,
                textFilter,
                format: argv.format as string | undefined,
            });

            if (output) {
                console.log(output);
            }
        },
    } satisfies CommandModule;
}

export { strings };
export type { ListOptions } from '../services/strings.js';
